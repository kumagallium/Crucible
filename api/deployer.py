"""
MCP Registry API — デプロイロジック

GitHub clone → docker build → docker run → Dify 登録 → レジストリ更新
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Generator

import registry
from crypto import decrypt_token, encrypt_token
from models import RegisterRequest, ServerRecord

# Dify 設定 (環境変数から取得)
DIFY_API_BASE   = os.environ.get("DIFY_API_BASE", "http://localhost/console/api")
DIFY_EMAIL      = os.environ.get("DIFY_EMAIL", "")
DIFY_PASSWORD   = os.environ.get("DIFY_PASSWORD", "")

# GitHub 認証 (プライベートリポジトリ用)
GITHUB_TOKEN    = os.environ.get("GITHUB_TOKEN", "")

# Docker ネットワーク名
MCP_NETWORK     = os.environ.get("MCP_NETWORK", "mcp-net")
DIFY_NETWORK    = os.environ.get("DIFY_NETWORK", "docker_default")

# Dify DB 設定 (削除時の Dify 登録解除に使用)
DIFY_DB_CONTAINER = os.environ.get("DIFY_DB_CONTAINER", "docker-db-1")
DIFY_DB_USER      = os.environ.get("DIFY_DB_USER", "postgres")
DIFY_DB_NAME      = os.environ.get("DIFY_DB_NAME", "dify")

# ポートバインド先 IP（MCP サーバーコンテナを公開する先の IP）
CRUCIBLE_HOST     = os.environ.get("CRUCIBLE_HOST", "127.0.0.1")

# ヘルスチェック設定
HEALTH_CHECK_RETRIES = 24
HEALTH_CHECK_INTERVAL = 5  # 秒


LogFn = Callable[[str], None]


def _run(
    cmd: list[str], log: LogFn, cwd: str | None = None, env: dict | None = None
) -> None:
    """コマンドを実行しログに出力する。エラー時は RuntimeError を raise する。"""
    # トークンを含む URL はログに出さない
    display_cmd = [
        c.replace(c, "<token>@github.com") if "@github.com" in c else c
        for c in cmd
    ]
    log(f"$ {' '.join(display_cmd)}")
    result = subprocess.run(
        cmd,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.stdout:
        for line in result.stdout.strip().splitlines():
            log(line)
    if result.returncode != 0:
        if result.stderr:
            for line in result.stderr.strip().splitlines():
                log(f"[stderr] {line}")
        raise RuntimeError(
            f"コマンド失敗 (exit={result.returncode}): {' '.join(cmd)}"
        )


def _run_stream(
    cmd: list[str], log: LogFn, cwd: str | None = None, env: dict | None = None
) -> None:
    """コマンドを実行し、出力をリアルタイムでログに流す。"""
    log(f"$ {' '.join(cmd)}")
    process = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    if process.stdout:
        for line in process.stdout:
            log(line.rstrip())
    process.wait()
    if process.returncode != 0:
        raise RuntimeError(
            f"コマンド失敗 (exit={process.returncode}): {' '.join(cmd)}"
        )


def _step(n: int, total: int, msg: str, log: LogFn) -> None:
    log(f"[{n}/{total}] {msg}")


def _resolve_request_from_mcp_json(
    req: RegisterRequest, mcp_json_path: Path, log: LogFn
) -> None:
    """mcp.json の値で RegisterRequest の未入力フィールドを補完する。"""
    try:
        data = json.loads(mcp_json_path.read_text(encoding="utf-8"))
    except Exception as e:
        log(f"  mcp.json の読み込みに失敗しました: {e}")
        return

    if not req.name:
        req.name = data.get("name", "")
        log(f"  name を mcp.json から取得: {req.name}")
    if not req.display_name:
        req.display_name = data.get("display_name", req.name)
        log(f"  display_name を mcp.json から取得: {req.display_name}")
    if not req.description:
        req.description = data.get("description", "")
    if req.icon == "🔧":  # デフォルト値のまま = 未指定
        dify = data.get("dify", {})
        req.icon = dify.get("icon", req.icon)


def _generate_mcp_json(
    req: RegisterRequest,
    port: int,
    static_ip: str,
    target_dir: Path,
) -> None:
    """mcp.json を生成してリポジトリに書き込む。"""
    mcp = {
        "schema_version": "1.0",
        "name": req.name,
        "display_name": req.display_name,
        "description": req.description,
        "version": "0.1.0",
        "author": "user",
        "port": port,
        "transport": "auto",
        "health_check": "/mcp",
        "dify": {
            "auto_register": req.dify_auto_register,
            "label": req.display_name,
            "icon": req.icon,
            "icon_background": "#E5F0FF",
        },
        "env": {
            "required": [],
            "optional": list(req.env_vars.keys()),
        },
        "groups": [req.group],
        "static_ip": static_ip,
    }
    mcp_path = target_dir / "mcp.json"
    mcp_path.write_text(json.dumps(mcp, indent=2, ensure_ascii=False), encoding="utf-8")


def _clone_repo(req: RegisterRequest, dest: Path, log: LogFn, stored_token_enc: str = "") -> None:
    """GitHub リポジトリをクローンする。"""
    # プライベートリポジトリ: トークンを URL に埋め込む
    # 優先順位: リクエスト指定 > 保存済み暗号化token > 環境変数 GITHUB_TOKEN
    clone_url = req.github_url
    stored_token = decrypt_token(stored_token_enc) if stored_token_enc else ""
    token = req.github_token or stored_token or GITHUB_TOKEN
    if token and clone_url.startswith("https://github.com/"):
        clone_url = clone_url.replace(
            "https://github.com/", f"https://{token}@github.com/"
        )

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"  # 認証プロンプトを無効化

    _run(
        ["git", "clone", "--depth", "1", "-b", req.branch, clone_url, str(dest)],
        log,
        env=env,
    )


def _strip_mount_options(dockerfile: Path, log: LogFn) -> None:
    """Dockerfile から BuildKit 専用の --mount オプションを除去する。

    socket-proxy 環境ではレガシービルダーしか使えないため、
    RUN --mount=type=cache,target=... cmd → RUN cmd に変換する。
    --mount はキャッシュ最適化等が主目的で、除去しても機能的に同等。
    """
    if not dockerfile.exists():
        return
    original = dockerfile.read_text(encoding="utf-8")
    # --mount=type=xxx,key=val,... の部分を除去（複数指定にも対応）
    stripped = re.sub(r"--mount=\S+\s*", "", original)
    if stripped != original:
        dockerfile.write_text(stripped, encoding="utf-8")
        log("  Dockerfile の --mount オプションを除去しました（レガシービルダー互換）")


def _detect_transport(src_dir: Path, transport: str) -> str:
    """MCP サーバーのトランスポートを検出する。

    auto の場合: Dockerfile に EXPOSE があれば SSE、なければ stdio と判定。
    """
    if transport != "auto":
        return transport
    dockerfile = src_dir / "Dockerfile"
    if dockerfile.exists():
        content = dockerfile.read_text(encoding="utf-8")
        if re.search(r"^\s*EXPOSE\s+", content, re.MULTILINE):
            return "sse"
    return "stdio"


def _has_node(name: str) -> bool:
    """ベースイメージに Node.js (npm) が存在するか判定する。"""
    result = subprocess.run(
        ["docker", "run", "--rm", f"{name}:latest", "which", "npm"],
        capture_output=True,
    )
    return result.returncode == 0


def _wrap_with_mcp_proxy(name: str, log: LogFn) -> None:
    """stdio MCP サーバーを mcp-proxy で SSE 化するラッパーイメージを生成する。

    mcp-proxy の --stateless モードを使用し、接続ごとに新しいサーバープロセスを
    生成することで、Dify 等からの複数回接続・再接続に対応する。

    ベースイメージに Node.js があれば npm 版、なければ Python (pip) 版を使用する。
    """
    # 元イメージの CMD / ENTRYPOINT を取得
    result = subprocess.run(
        [
            "docker", "inspect", "--format",
            "{{json .Config.Entrypoint}}\t{{json .Config.Cmd}}",
            f"{name}:latest",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"docker inspect 失敗: {result.stderr.strip()}")

    parts = result.stdout.strip().split("\t")
    entrypoint = json.loads(parts[0]) if parts[0] != "null" else []
    cmd = json.loads(parts[1]) if len(parts) > 1 and parts[1] != "null" else []
    original_cmd_parts = entrypoint + cmd

    if not original_cmd_parts:
        raise RuntimeError("元イメージの CMD/ENTRYPOINT が取得できません")

    log(f"  stdio 検出: 元コマンド = {' '.join(original_cmd_parts)}")
    log("  mcp-proxy (--stateless) で SSE 化します")

    # ベースイメージの環境に応じて mcp-proxy のインストール方法を決定
    use_node = _has_node(name)
    if use_node:
        install_cmd = "RUN npm install -g mcp-proxy"
        proxy_cmd = ["npx", "mcp-proxy", "--stateless", "--host", "0.0.0.0", "--port", "8000", "--"]
        log("  Node.js 検出 → npm 版 mcp-proxy を使用")
    else:
        install_cmd = "RUN pip install --no-cache-dir mcp-proxy"
        proxy_cmd = ["mcp-proxy", "--stateless", "--host", "0.0.0.0", "--port", "8000", "--"]
        log("  Node.js 未検出 → Python (pip) 版 mcp-proxy を使用")

    # ラッパー Dockerfile を生成してビルド
    wrapper_dir = Path(tempfile.mkdtemp(prefix="crucible-mcp-proxy-"))
    try:
        wrapper_dockerfile = wrapper_dir / "Dockerfile"
        wrapper_dockerfile.write_text(
            f"FROM {name}:latest\n"
            f"{install_cmd}\n"
            f"ENTRYPOINT []\n"
            f"EXPOSE 8000\n"
            f'CMD {json.dumps(proxy_cmd + original_cmd_parts)}\n',
            encoding="utf-8",
        )
        _run_stream(
            ["docker", "build", "-t", f"{name}:latest", "."],
            log,
            cwd=str(wrapper_dir),
        )
    finally:
        shutil.rmtree(wrapper_dir, ignore_errors=True)


def _build_image(
    name: str, src_dir: Path, log: LogFn, context_dir: Path | None = None
) -> None:
    """Docker イメージをビルドする。

    サブディレクトリ指定時はリポジトリルートをコンテキストにして Dockerfile を指定する
    (デファクトスタンダード: modelcontextprotocol/servers 等の COPY src/xxx /app 形式)。
    """
    # socket-proxy 環境では BuildKit（gRPC）が使えないため、レガシービルダーを使用
    # Dockerfile 内の --mount オプション（BuildKit 専用）を除去して互換性を確保
    dockerfile = src_dir / "Dockerfile"
    _strip_mount_options(dockerfile, log)

    if context_dir is not None:
        _run_stream(
            [
                "docker", "build",
                "-t", f"{name}:latest",
                "-f", str(src_dir / "Dockerfile"),
                ".",
            ],
            log,
            cwd=str(context_dir),
        )
    else:
        _run_stream(
            ["docker", "build", "-t", f"{name}:latest", "."],
            log,
            cwd=str(src_dir),
        )


def _start_container(
    name: str, port: int, static_ip: str, env_vars: dict[str, str], log: LogFn
) -> None:
    """コンテナを起動する。既存コンテナは停止・削除する。"""
    # 既存コンテナを停止・削除
    existing = subprocess.run(
        ["docker", "ps", "-a", "--format", "{{.Names}}"],
        capture_output=True, text=True,
    ).stdout.splitlines()
    if name in existing:
        log(f"既存コンテナ '{name}' を停止・削除します")
        subprocess.run(["docker", "stop", name], capture_output=True)
        subprocess.run(["docker", "rm",   name], capture_output=True)

    # docker run コマンド構築
    cmd = [
        "docker", "run", "-d",
        "--name", name,
        "-p", f"{CRUCIBLE_HOST}:{port}:8000",
        "--restart", "unless-stopped",
    ]

    # 環境変数を追加
    for k, v in env_vars.items():
        cmd += ["-e", f"{k}={v}"]

    # mcp-net が存在する場合は固定 IP で接続
    net_check = subprocess.run(
        ["docker", "network", "inspect", MCP_NETWORK],
        capture_output=True,
    )
    if net_check.returncode == 0:
        cmd += ["--network", MCP_NETWORK, "--ip", static_ip]
        log(f"mcp-net に固定 IP {static_ip} で接続します")
    else:
        log(f"mcp-net が見つかりません。Dify ネットワーク ({DIFY_NETWORK}) に接続します")

    cmd.append(f"{name}:latest")
    _run(cmd, log)

    # mcp-net を使わない場合は Dify ネットワークに接続
    if net_check.returncode != 0:
        subprocess.run(
            ["docker", "network", "connect", DIFY_NETWORK, name],
            capture_output=True,
        )
        log(f"Dify ネットワーク ({DIFY_NETWORK}) に接続しました")


def _health_check(name: str, port: int, log: LogFn) -> None:
    """コンテナのヘルスチェックを行う。"""
    log(f"ヘルスチェック中 (localhost:{port}) ...")
    for i in range(1, HEALTH_CHECK_RETRIES + 1):
        # TCP ポートが開いているか確認
        tcp_check = subprocess.run(
            ["bash", "-c", f"echo >/dev/tcp/localhost/{port}"],
            capture_output=True,
        )
        if tcp_check.returncode == 0:
            log(f"ヘルスチェック OK — ポート {port} 開通 ({i}/{HEALTH_CHECK_RETRIES})")
            return

        # コンテナが Running かも確認
        state = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", name],
            capture_output=True, text=True,
        ).stdout.strip()
        if state == "true":
            log(f"コンテナ起動確認済み ({i}/{HEALTH_CHECK_RETRIES})")
            return

        log(f"待機中... ({i}/{HEALTH_CHECK_RETRIES})")
        time.sleep(HEALTH_CHECK_INTERVAL)

    raise RuntimeError(
        f"ヘルスチェックがタイムアウトしました。ログ確認: docker logs {name}"
    )


def _register_dify(
    name: str, static_ip: str, port: int,
    icon: str, display_name: str,
    log: LogFn,
) -> bool:
    """Dify に MCP ツールプロバイダーとして登録する。"""
    if not (DIFY_EMAIL and DIFY_PASSWORD):
        log("DIFY_EMAIL / DIFY_PASSWORD が未設定のため Dify 登録をスキップします")
        return False

    import http.client
    import json as _json
    import urllib.parse
    import requests as req_lib

    # ログイン — requests で行う (レスポンスのクッキーを読むだけなので問題なし)
    try:
        login_resp = req_lib.post(
            f"{DIFY_API_BASE}/login",
            json={"email": DIFY_EMAIL, "password": DIFY_PASSWORD},
            timeout=15,
        )
        result = login_resp.json()
        if result.get("result") != "success":
            log(f"Dify ログイン失敗: {result}")
            return False
    except Exception as e:
        log(f"Dify ログイン失敗: {e}")
        return False

    # Set-Cookie から直接トークン取得
    access_token = login_resp.cookies.get("access_token", "")
    csrf_token   = login_resp.cookies.get("csrf_token", "")
    if not access_token:
        log("Dify ログイン失敗: access_token クッキーが見つかりません")
        return False

    # エンドポイント URL の決定: トランスポート自動検出
    # SSE (/sse) → Streamable HTTP (/mcp) の順でチェック
    base_url = f"http://{static_ip}:8000"
    server_url = f"{base_url}/sse"  # デフォルトは SSE
    try:
        # /sse を確認（タイムアウト=SSEストリーム接続中で正常の可能性あり）
        sse_resp = req_lib.get(f"{base_url}/sse", timeout=3)
        if sse_resp.status_code == 404:
            # /mcp を確認
            mcp_resp = req_lib.get(f"{base_url}/mcp", timeout=3)
            if mcp_resp.status_code != 404:
                server_url = f"{base_url}/mcp"
                log(f"  トランスポート: Streamable HTTP (/mcp)")
            else:
                log(f"  トランスポート: SSE (/sse) — フォールバック")
        else:
            log(f"  トランスポート: SSE (/sse)")
    except req_lib.exceptions.Timeout:
        # タイムアウト = SSE ストリーム接続中（正常）
        log(f"  トランスポート: SSE (/sse)")
    except Exception:
        # 接続エラー時は /sse をデフォルトで使用
        log(f"  トランスポート: SSE (/sse) — フォールバック")

    # MCP ツールプロバイダーとして登録
    # http.client を使用: requests の DefaultCookiePolicy (シングルラベルホスト名の
    # クッキー送信を拒否) を完全にバイパスし、Cookie ヘッダーをそのまま送信する
    try:
        parsed   = urllib.parse.urlparse(DIFY_API_BASE)
        body     = _json.dumps({
            "server_url":        server_url,
            "name":              name,
            "icon":              icon,
            "icon_type":         "emoji",
            "icon_background":   "#E5F0FF",
            "server_identifier": name,
        }).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Cookie":       f"access_token={access_token}; csrf_token={csrf_token}",
            "X-CSRF-Token": csrf_token,
        }
        mcp_path = f"{parsed.path}/workspaces/current/tool-provider/mcp"

        conn = http.client.HTTPConnection(parsed.netloc, timeout=15)
        conn.request("POST", mcp_path, body, headers)
        resp      = conn.getresponse()
        resp_body = resp.read().decode("utf-8")
        conn.close()

        # 既に同じ URL で登録済みの場合は DB から直接削除してから再登録
        if resp.status == 400 and "already exists" in resp_body:
            log("  既存の Dify 登録を DB から削除して再登録します")
            _unregister_dify(name, log)

            conn = http.client.HTTPConnection(parsed.netloc, timeout=15)
            conn.request("POST", mcp_path, body, headers)
            resp      = conn.getresponse()
            resp_body = resp.read().decode("utf-8")
            conn.close()

        if resp.status >= 400:
            log(f"Dify 登録失敗 (手動で登録してください — URL: {server_url}): HTTP {resp.status} {resp_body}")
            return False
        log(f"Dify 登録完了: {name} ({server_url})")
        return True
    except Exception as e:
        log(f"Dify 登録失敗 (手動で登録してください — URL: {server_url}): {e}")
        return False


def deploy(req: RegisterRequest, log: LogFn) -> ServerRecord:
    """
    デプロイのフルフロー。
    各ステップで log() を呼びながら進める。
    成功すると ServerRecord を返す。
    """
    TOTAL = 7
    log(f"=== MCP サーバーデプロイ開始: {req.name or '(名前は mcp.json から解決)'} ===")

    # ポート・IP 割り当て
    _step(1, TOTAL, "ポート・IP を割り当て中...", log)
    port      = registry.next_port(req.group)
    static_ip = registry.next_static_ip(req.group)
    log(f"  ポート: {port}  固定 IP: {static_ip}")

    # 再デプロイ時に備えて保存済み暗号化tokenを事前取得（名前が分かる場合のみ）
    _pre_existing = registry.get(req.name) if req.name else None
    existing_token_enc: str = _pre_existing.github_token_enc if _pre_existing else ""

    # 作業ディレクトリ作成
    work_dir = Path(tempfile.mkdtemp(prefix=f"crucible-deploy-{req.name or 'unknown'}-"))
    try:
        # GitHub クローン
        _step(2, TOTAL, f"GitHub クローン: {req.github_url} ({req.branch})", log)
        clone_dir = work_dir / (req.name or "repo")
        _clone_repo(req, clone_dir, log, stored_token_enc=existing_token_enc)

        # サブディレクトリの決定 (モノリポ対応)
        build_dir = clone_dir / req.subdir if req.subdir else clone_dir
        if req.subdir:
            log(f"  サブディレクトリを使用: {req.subdir}")
        if not build_dir.exists():
            raise RuntimeError(f"サブディレクトリが見つかりません: {req.subdir}")

        # mcp.json の確認・自動補完
        _step(3, TOTAL, "mcp.json の確認・生成...", log)
        mcp_json_path = build_dir / "mcp.json"
        if mcp_json_path.exists():
            _resolve_request_from_mcp_json(req, mcp_json_path, log)
            log("  既存の mcp.json を使用します")
            # mcp.json から名前が解決された場合、保存済みtokenが未取得なら改めて取得
            if not existing_token_enc and req.name:
                _resolved_existing = registry.get(req.name)
                existing_token_enc = _resolved_existing.github_token_enc if _resolved_existing else ""
        else:
            if not req.name:
                raise RuntimeError(
                    "mcp.json が見つかりません。"
                    "リポジトリに mcp.json を追加するか、サーバー名を入力してください。"
                )
            _generate_mcp_json(req, port, static_ip, build_dir)
            log("  mcp.json を自動生成しました")

        # 名前解決後の重複チェック
        # error / deploying 状態の既存レコードは再デプロイを許可し、古いコンテナをクリーンアップ
        existing = registry.get(req.name)
        if existing:
            if existing.status not in ("error", "deploying"):
                raise RuntimeError(f"サーバー名 '{req.name}' は既に登録されています")
            log(f"  既存の失敗レコード (status={existing.status}) を上書きして再デプロイします")
            subprocess.run(["docker", "stop", req.name], capture_output=True)
            subprocess.run(["docker", "rm",   req.name], capture_output=True)
            log(f"  古いコンテナを削除しました")

        # deploying としてレジストリに仮登録
        provisional = ServerRecord(
            name=req.name,
            display_name=req.display_name or req.name,
            description=req.description,
            icon=req.icon,
            github_url=req.github_url,
            branch=req.branch,
            subdir=req.subdir,
            group=req.group,
            port=0,
            static_ip="",
            status="deploying",
        )
        registry.upsert(provisional)

        # トランスポート検出
        transport = _detect_transport(build_dir, req.transport)
        if transport == "stdio":
            log(f"  トランスポート: stdio（supergateway で SSE 化）")
        else:
            log(f"  トランスポート: {transport}（Dify 登録時に自動検出）")

        # Docker ビルド
        # サブディレクトリ指定時はリポジトリルートをコンテキストにして Dockerfile を指定
        _step(4, TOTAL, "Docker イメージをビルド中...", log)
        _build_image(
            req.name,
            build_dir,
            log,
            context_dir=clone_dir if req.subdir else None,
        )

        # stdio サーバーの場合、supergateway で SSE 化
        if transport == "stdio":
            _wrap_with_mcp_proxy(req.name, log)

        # コンテナ起動
        _step(5, TOTAL, "コンテナを起動中...", log)
        _start_container(req.name, port, static_ip, req.env_vars, log)

        # ヘルスチェック
        _step(6, TOTAL, "ヘルスチェック...", log)
        _health_check(req.name, port, log)

        # Dify 登録
        _step(7, TOTAL, "Dify への登録...", log)
        dify_ok = _register_dify(
            req.name, static_ip, port, req.icon, req.display_name, log
        )

    finally:
        # 一時ディレクトリを削除
        shutil.rmtree(work_dir, ignore_errors=True)

    # GitHub Token を暗号化して保存
    # 優先順位: リクエスト指定 > 既存レコードの保存済みtoken
    if req.github_token:
        token_enc = encrypt_token(req.github_token)
    else:
        token_enc = existing_token_enc

    # レジストリ更新（error_message を明示的にクリア）
    record = ServerRecord(
        name=req.name,
        display_name=req.display_name,
        description=req.description,
        icon=req.icon,
        github_url=req.github_url,
        branch=req.branch,
        subdir=req.subdir,
        group=req.group,
        port=port,
        static_ip=static_ip,
        status="running",
        dify_registered=dify_ok,
        error_message=None,
        github_token_enc=token_enc,
    )
    registry.upsert(record)

    log(f"=== デプロイ完了: {req.name} (ポート {port}) ===")
    return record


def _unregister_dify(name: str, log: LogFn) -> None:
    """Dify の MCP ツールプロバイダー登録を DB から直接削除する（ベストエフォート）。

    Dify v1.9.x に MCP プロバイダーの DELETE API が存在しないため、
    DB (tool_mcp_providers) から直接削除する。失敗しても削除処理はブロックしない。
    """
    try:
        result = subprocess.run(
            [
                "docker", "exec", DIFY_DB_CONTAINER,
                "psql", "-U", DIFY_DB_USER, "-d", DIFY_DB_NAME, "-c",
                f"DELETE FROM tool_mcp_providers WHERE name = '{name}';",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            log(f"Dify 登録解除完了: {name}")
        else:
            log(f"Dify 登録解除スキップ: {result.stderr.strip()}")
    except Exception as e:
        log(f"Dify 登録解除スキップ: {e}")


def remove(name: str, log: LogFn) -> None:
    """コンテナを停止・削除し、レジストリ・Dify からも削除する。"""
    log(f"コンテナ停止・削除: {name}")
    subprocess.run(["docker", "stop", name], capture_output=True)
    subprocess.run(["docker", "rm",   name], capture_output=True)
    _unregister_dify(name, log)
    registry.delete(name)
    log(f"削除完了: {name}")


def restart(name: str, log: LogFn) -> None:
    """コンテナを再起動する。"""
    log(f"コンテナ再起動: {name}")
    _run(["docker", "restart", name], log)

    record = registry.get(name)
    if record:
        _health_check(name, record.port, log)
        record.status = "running"
        record.error_message = None
        registry.upsert(record)
    log(f"再起動完了: {name}")


def refresh_statuses() -> None:
    """全コンテナのステータスを Docker から同期する。docker CLI が無い場合はスキップ。"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True, text=True,
        )
        running = result.stdout.splitlines()
    except FileNotFoundError:
        # docker CLI がコンテナ内に存在しない場合はステータス更新をスキップ
        return

    for record in registry.get_all():
        new_status = "running" if record.name in running else "stopped"
        if record.status != new_status:
            record.status = new_status
            registry.upsert(record)
