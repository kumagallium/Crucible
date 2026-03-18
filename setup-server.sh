#!/bin/bash
# ==============================================================================
# Crucible Registry — サーバーセットアップスクリプト
# ==============================================================================
# クリーンな Ubuntu 22.04+ サーバーに以下を一括セットアップする:
#   1. Docker + Docker Compose インストール
#   2. セキュリティ強化 (SSH / ファイアウォール / fail2ban / Docker iptables)
#   3. .env 生成（キー自動生成）
#   4. Crucible Registry の起動
#
# 使い方:
#   git clone https://github.com/kumagallium/Crucible.git
#   cd Crucible
#   sudo bash setup-server.sh
#
# オプション:
#   SSH_PORT=<port> sudo bash setup-server.sh  # SSH ポートを変更（デフォルト: 22, 変更推奨）
#
# 注意:
#   - SSH ポートが変更されるため、コンソール接続を推奨
#   - 実行後は新しい SSH ポートで接続すること
# ==============================================================================

set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ==============================================================================
# ログ関数
# ==============================================================================
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
info() { log "INFO:  $*"; }
warn() { log "WARN:  $*" >&2; }
die()  { log "ERROR: $*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "このスクリプトは root で実行してください (sudo bash setup-server.sh)"

export DEBIAN_FRONTEND=noninteractive

# ==============================================================================
# 1. Docker インストール
# ==============================================================================
install_docker() {
    if command -v docker &>/dev/null; then
        info "[1/7] Docker は既にインストール済み ($(docker --version))"
        return
    fi

    info "[1/7] Docker をインストール中..."

    apt-get update -qq
    apt-get install -y -qq ca-certificates curl

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin

    # 実行ユーザーを docker グループに追加
    if [[ -n "${SUDO_USER:-}" ]]; then
        usermod -aG docker "${SUDO_USER}"
        info "  ユーザー ${SUDO_USER} を docker グループに追加しました"
    fi

    info "[1/7] Docker インストール完了"
}

# ==============================================================================
# 2. SSH 強化
# ==============================================================================
harden_ssh() {
    info "[2/7] SSH を強化中 (ポート: ${SSH_PORT})..."

    cat > /etc/ssh/sshd_config.d/hardening.conf << EOF
Port ${SSH_PORT}
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
EOF

    systemctl restart sshd
    info "[2/7] SSH 強化完了 (ポート ${SSH_PORT}、鍵認証のみ)"
}

# ==============================================================================
# 3. ファイアウォール (UFW)
# ==============================================================================
setup_firewall() {
    info "[3/7] ファイアウォールを設定中..."

    apt-get install -y -qq ufw

    # リセットしてクリーンに設定
    ufw --force reset

    ufw default deny incoming
    ufw default deny outgoing
    ufw default allow routed

    # インバウンド: SSH + Crucible ポートのみ
    ufw allow in "${SSH_PORT}/tcp" comment "SSH"
    ufw allow in 8080/tcp          comment "Crucible API"
    ufw allow in 8081/tcp          comment "Crucible UI"

    # アウトバウンド: 必要最小限
    ufw allow out 22/tcp    comment "SSH (git clone)"
    ufw allow out 53/udp    comment "DNS"
    ufw allow out 53/tcp    comment "DNS over TCP"
    ufw allow out 80/tcp    comment "HTTP"
    ufw allow out 123/udp   comment "NTP"
    ufw allow out 443/tcp   comment "HTTPS"

    # Docker ブリッジネットワークへの通信を許可 (localhost → コンテナ)
    ufw allow out to 172.16.0.0/12

    # loopback
    ufw allow in on lo
    ufw allow out on lo

    ufw --force enable
    info "[3/7] ファイアウォール設定完了"
}

# ==============================================================================
# 4. fail2ban
# ==============================================================================
setup_fail2ban() {
    info "[4/7] fail2ban を設定中..."

    apt-get install -y -qq fail2ban

    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime  = 86400
findtime = 600
maxretry = 5

[sshd]
enabled  = true
port     = ${SSH_PORT}
filter   = sshd
logpath  = %(sshd_log)s
maxretry = 5
EOF

    systemctl enable --now fail2ban
    systemctl restart fail2ban
    info "[4/7] fail2ban 設定完了 (SSH: 5回失敗で24時間 BAN)"
}

# ==============================================================================
# 5. Docker iptables セキュリティ (DOCKER-USER チェーン)
# ==============================================================================
setup_docker_security() {
    info "[5/7] Docker iptables セキュリティを設定中..."

    # 外部 NIC を自動検出
    EXT_NIC=$(ip route get 8.8.8.8 | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1); exit}')
    info "  外部 NIC: ${EXT_NIC}"

    # DOCKER-USER チェーンが存在するまで待機
    for i in $(seq 1 12); do
        if iptables -L DOCKER-USER &>/dev/null; then break; fi
        sleep 5
    done

    if ! iptables -L DOCKER-USER &>/dev/null; then
        warn "  DOCKER-USER チェーンが見つかりません (Docker が起動していない可能性)"
        return
    fi

    # MCP サーバーが動的にポートを使うため、Docker Socket Proxy ポートのみブロック
    # (API/UI ポートは UFW で制御)
    iptables -D DOCKER-USER -i "${EXT_NIC}" -p tcp --dport 2375 -j DROP 2>/dev/null || true
    iptables -I DOCKER-USER -i "${EXT_NIC}" -p tcp --dport 2375 -j DROP

    # コンテナからの UDP フラッド対策
    for cidr in 172.16.0.0/12 192.168.0.0/16 10.0.0.0/8; do
        iptables -D DOCKER-USER -s "${cidr}" -p udp --dport 53  -j ACCEPT 2>/dev/null || true
        iptables -I DOCKER-USER -s "${cidr}" -p udp --dport 53  -j ACCEPT
        iptables -D DOCKER-USER -s "${cidr}" -p udp --dport 123 -j ACCEPT 2>/dev/null || true
        iptables -I DOCKER-USER -s "${cidr}" -p udp --dport 123 -j ACCEPT
        iptables -D DOCKER-USER -s "${cidr}" -p udp -j DROP 2>/dev/null || true
        iptables -A DOCKER-USER -s "${cidr}" -p udp -j DROP
        iptables -D DOCKER-USER -s "${cidr}" -p tcp --syn \
            -m connlimit --connlimit-above 200 -j REJECT 2>/dev/null || true
        iptables -A DOCKER-USER -s "${cidr}" -p tcp --syn \
            -m connlimit --connlimit-above 200 -j REJECT
    done

    # iptables ルールを永続化
    apt-get install -y -qq iptables-persistent
    iptables-save > /etc/iptables/rules.v4

    # 再起動時にルールを再適用する systemd サービス
    cat > /opt/crucible-docker-rules.sh << SCRIPT
#!/bin/bash
set -euo pipefail
for i in \$(seq 1 12); do
    if iptables -L DOCKER-USER &>/dev/null; then break; fi
    sleep 5
done
iptables -L DOCKER-USER &>/dev/null || exit 1

iptables -D DOCKER-USER -i ${EXT_NIC} -p tcp --dport 2375 -j DROP 2>/dev/null || true
iptables -I DOCKER-USER -i ${EXT_NIC} -p tcp --dport 2375 -j DROP

for cidr in 172.16.0.0/12 192.168.0.0/16 10.0.0.0/8; do
    iptables -D DOCKER-USER -s "\${cidr}" -p udp --dport 53  -j ACCEPT 2>/dev/null || true
    iptables -I DOCKER-USER -s "\${cidr}" -p udp --dport 53  -j ACCEPT
    iptables -D DOCKER-USER -s "\${cidr}" -p udp --dport 123 -j ACCEPT 2>/dev/null || true
    iptables -I DOCKER-USER -s "\${cidr}" -p udp --dport 123 -j ACCEPT
    iptables -D DOCKER-USER -s "\${cidr}" -p udp -j DROP 2>/dev/null || true
    iptables -A DOCKER-USER -s "\${cidr}" -p udp -j DROP
    iptables -D DOCKER-USER -s "\${cidr}" -p tcp --syn -m connlimit --connlimit-above 200 -j REJECT 2>/dev/null || true
    iptables -A DOCKER-USER -s "\${cidr}" -p tcp --syn -m connlimit --connlimit-above 200 -j REJECT
done
echo "DOCKER-USER rules applied: \$(date)"
SCRIPT

    chmod 700 /opt/crucible-docker-rules.sh

    cat > /etc/systemd/system/crucible-docker-rules.service << 'EOF'
[Unit]
Description=Crucible DOCKER-USER iptables security rules
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/crucible-docker-rules.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable crucible-docker-rules.service
    info "[5/7] Docker iptables セキュリティ完了"
}

# ==============================================================================
# 6. 自動セキュリティアップデート
# ==============================================================================
setup_auto_update() {
    info "[6/7] 自動セキュリティアップデートを設定中..."

    apt-get install -y -qq unattended-upgrades

    cat > /etc/apt/apt.conf.d/50unattended-upgrades-custom << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF

    systemctl enable --now unattended-upgrades
    info "[6/7] 自動セキュリティアップデート完了"
}

# ==============================================================================
# 7. Crucible Registry を起動
# ==============================================================================
start_crucible() {
    info "[7/7] Crucible Registry を起動中..."

    cd "${SCRIPT_DIR}"

    # .env がなければ setup.sh を呼んで生成
    if [[ ! -f .env ]]; then
        info "  .env を自動生成します..."
        bash setup.sh
    fi

    docker compose build
    docker compose up -d

    # 起動待機
    for i in $(seq 1 15); do
        if curl -sf --max-time 2 http://localhost:8080/health > /dev/null 2>&1; then
            info "  Crucible Registry が正常に起動しました"
            return
        fi
        sleep 3
    done

    warn "  起動を確認できませんでした (docker compose logs で確認してください)"
}

# ==============================================================================
# メイン処理
# ==============================================================================
main() {
    info "======================================================="
    info "  Crucible Registry — サーバーセットアップ"
    info "======================================================="

    install_docker
    harden_ssh
    setup_firewall
    setup_fail2ban

    # Docker が起動するまで少し待つ
    sleep 3

    start_crucible
    setup_docker_security
    setup_auto_update

    info "======================================================="
    info "  セットアップ完了"
    info "======================================================="
    info ""
    info "【適用された設定】"
    info "  SSH:        ポート ${SSH_PORT}、鍵認証のみ、root ログイン禁止"
    info "  UFW:        インバウンド deny（SSH / 8080 / 8081 のみ許可）"
    info "  fail2ban:   SSH 5回失敗で24時間 BAN"
    info "  Docker:     外部から Socket Proxy (2375) へのアクセスをブロック"
    info "  自動更新:   セキュリティパッチを自動適用（深夜4時再起動）"
    info ""
    info "【次のステップ】"
    info "  1. .env を確認（CRUCIBLE_HOST をサーバーの IP に変更する場合）"
    info "  2. docker compose restart"
    info ""
    info "【アクセス方法】"
    info "  SSH: ssh -p ${SSH_PORT} <user>@<server-ip>"
    info "  UI:  http://<server-ip>:8081"
    info "  API: http://<server-ip>:8080"
    info ""
    warn "SSH ポートが ${SSH_PORT} に変更されました。新しいポートで接続してください。"
}

main "$@"
