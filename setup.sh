#!/usr/bin/env bash
# ==============================================================================
# Crucible セットアップスクリプト
# .env の生成（キー自動生成）と git hooks の設定を行う
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- 色付き出力 ---
info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$1"; }
ok()    { printf '\033[1;32m[OK]\033[0m    %s\n' "$1"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$1"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$1"; }

# --- キー生成ユーティリティ ---
generate_hex_key() {
  # openssl が使える場合は openssl、なければ python3
  if command -v openssl &>/dev/null; then
    openssl rand -hex "$1"
  elif command -v python3 &>/dev/null; then
    python3 -c "import secrets; print(secrets.token_hex($1))"
  else
    error "openssl または python3 が必要です"
    exit 1
  fi
}

# ==============================================================================
# 1. .env ファイルの生成
# ==============================================================================
info "環境変数ファイル (.env) をセットアップします"

if [[ -f .env ]]; then
  warn ".env は既に存在します。上書きしますか? [y/N]"
  read -r answer
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    info ".env のセットアップをスキップしました"
    SKIP_ENV=true
  fi
fi

if [[ "${SKIP_ENV:-}" != "true" ]]; then
  # キーを自動生成
  REGISTRY_API_KEY=$(generate_hex_key 32)
  TOKEN_ENCRYPTION_KEY=$(generate_hex_key 32)

  # .env.example をベースにキーを埋め込む
  cp .env.example .env

  # プラットフォーム互換の sed (macOS / Linux)
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^REGISTRY_API_KEY=.*/REGISTRY_API_KEY=${REGISTRY_API_KEY}/" .env
    sed -i '' "s/^TOKEN_ENCRYPTION_KEY=.*/TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}/" .env
  else
    sed -i "s/^REGISTRY_API_KEY=.*/REGISTRY_API_KEY=${REGISTRY_API_KEY}/" .env
    sed -i "s/^TOKEN_ENCRYPTION_KEY=.*/TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}/" .env
  fi

  chmod 600 .env
  ok ".env を生成しました（REGISTRY_API_KEY, TOKEN_ENCRYPTION_KEY を自動生成済み）"
fi

# ==============================================================================
# 2. Git hooks の設定
# ==============================================================================
if [[ -d .git ]] || git rev-parse --git-dir &>/dev/null 2>&1; then
  info "Git hooks を設定します"
  git config core.hooksPath .githooks
  ok "Git hooks を .githooks に設定しました"
else
  warn "Git リポジトリではないため、hooks の設定をスキップしました"
fi

# ==============================================================================
# 3. 前提条件チェック
# ==============================================================================
info "前提条件を確認します"

MISSING=()
command -v docker &>/dev/null || MISSING+=("docker")
command -v git    &>/dev/null || MISSING+=("git")

# Docker Compose (plugin or standalone)
if docker compose version &>/dev/null 2>&1; then
  :
elif command -v docker-compose &>/dev/null; then
  :
else
  MISSING+=("docker compose")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  warn "以下のツールが見つかりません: ${MISSING[*]}"
  warn "インストール後に再実行してください"
else
  ok "前提条件を満たしています (docker, docker compose, git)"
fi

# ==============================================================================
# 完了
# ==============================================================================
echo ""
ok "セットアップ完了！"
echo ""
info "次のステップ:"
echo "  1. .env を確認・編集（必要に応じてポートや IP を変更）"
echo "  2. Crucible を起動:"
echo "       docker compose up -d"
echo ""
echo "  Dify 連携を使う場合:"
echo "       docker compose -f docker-compose.yml -f docker-compose.dify.yml up -d"
echo ""
info "UI:  http://127.0.0.1:8081"
info "API: http://127.0.0.1:8080"
