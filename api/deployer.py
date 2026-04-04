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
# ヘルスチェック用アクセス先（Docker Compose 等でコンテナ内から
# CRUCIBLE_HOST に到達できない場合に別の値を指定する）
HEALTH_CHECK_HOST = os.environ.get("CRUCIBLE_HEALTH_HOST", "") or CRUCIBLE_HOST

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


def _get_local_head(clone_dir: Path) -> str:
    """クローン済みリポジトリの HEAD コミットハッシュを取得する。"""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=str(clone_dir),
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def _get_remote_head(github_url: str, branch: str, token: str = "") -> str:
    """リモートリポジトリの最新コミットハッシュを git ls-remote で取得する。"""
    url = github_url
    if token and url.startswith("https://github.com/"):
        url = url.replace("https://github.com/", f"https://{token}@github.com/")

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"

    result = subprocess.run(
        ["git", "ls-remote", url, f"refs/heads/{branch}"],
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
    )
    if result.returncode != 0:
        return ""
    # 出力形式: "<hash>\trefs/heads/<branch>"
    parts = result.stdout.strip().split()
    return parts[0] if parts else ""


def _patch_fastmcp_enabled(src_dir: Path, log: LogFn) -> None:
    """FastMCP 3.x 互換パッチ: @mcp.tool(enabled=...) を除去する。

    FastMCP 3.x では @mcp.tool() / @mcp.prompt() の enabled パラメータが
    廃止されたため、ビルド前にソースコードから自動除去する。
    """
    patched_files = []
    for py_file in src_dir.rglob("*.py"):
        original = py_file.read_text(encoding="utf-8")
        # enabled=True/False を除去（前後のカンマ・スペースも処理）
        modified = re.sub(r",?\s*enabled\s*=\s*(True|False)\s*,?", lambda m: ", " if m.group(0).startswith(",") and m.group(0).rstrip().endswith(",") else "", original)
        # 括弧直後の不要なスペース・カンマを整理: (  name= → (name=
        modified = re.sub(r"\(\s+", "(", modified)
        # 末尾カンマ + 閉じ括弧を整理: , ) → )
        modified = re.sub(r",\s*\)", ")", modified)
        if modified != original:
            py_file.write_text(modified, encoding="utf-8")
            patched_files.append(py_file.name)
    if patched_files:
        log(f"  FastMCP 互換パッチ適用: enabled= を除去 ({', '.join(patched_files)})")


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


def _detect_tool_type(src_dir: Path) -> str:
    """リポジトリ構成からツール種別を推定する。

    判定基準（ツールの本質で判断）:
      1. 依存やソースに MCP SDK が含まれる → mcp_server
      2. それ以外のコードプロジェクト → cli_library
    """
    # Python: pyproject.toml / requirements.txt の依存に mcp が含まれるか
    for dep_file in ("pyproject.toml", "requirements.txt"):
        path = src_dir / dep_file
        if path.exists():
            content = path.read_text(encoding="utf-8")
            # "mcp" をパッケージ名として含むかチェック（"mcp[cli]", "mcp>=1.0" 等にマッチ）
            if re.search(r'(?:^|\s|"|\'|,)mcp(?:\[|>=|<=|==|>|<|~=|!=|\s|"|\'|,|$)', content):
                return "mcp_server"

    # Node.js: package.json の dependencies に MCP SDK が含まれるか
    pkg_json = src_dir / "package.json"
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text(encoding="utf-8"))
            all_deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if any("modelcontextprotocol" in dep or dep == "mcp" for dep in all_deps):
                return "mcp_server"
        except (json.JSONDecodeError, KeyError):
            pass

    # Dockerfile あり（依存で判定できなかった場合）→ mcp_server と推定
    if (src_dir / "Dockerfile").exists():
        return "mcp_server"

    # コードプロジェクトだが MCP 依存なし → cli_library
    if any(
        (src_dir / f).exists()
        for f in ("pyproject.toml", "requirements.txt", "package.json")
    ):
        return "cli_library"

    return "mcp_server"


def _detect_transport(src_dir: Path, transport: str) -> str:
    """MCP サーバーのトランスポート種別を検出する。

    auto の場合: Dockerfile に EXPOSE があれば HTTP ベース（SSE or Streamable HTTP）、
    なければ stdio と判定する。
    ここでは "sse" を返すが、実際のエンドポイントパス（/sse vs /mcp）は
    Dify 登録時の HTTP プローブで自動検出される。
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


def _detect_python_entrypoint(src_dir: Path) -> str | None:
    """pyproject.toml の [project.scripts] からエントリポイントを検出する。"""
    pyproject = src_dir / "pyproject.toml"
    if not pyproject.exists():
        return None
    content = pyproject.read_text(encoding="utf-8")
    # [project.scripts] セクションから最初のコマンド名を取得
    in_scripts = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped == "[project.scripts]":
            in_scripts = True
            continue
        if in_scripts:
            if stripped.startswith("["):
                break
            m = re.match(r'^(\S+)\s*=', stripped)
            if m:
                return m.group(1)
    return None


def _generate_dockerfile(src_dir: Path, log: LogFn) -> None:
    """Dockerfile がないリポジトリに対して、プロジェクト構成から自動生成する。

    対応パターン:
      1. pyproject.toml + uv.lock → uv ベース
      2. pyproject.toml のみ      → pip install . ベース
      3. requirements.txt のみ    → pip install -r ベース
      4. package.json             → Node.js ベース
    """
    dockerfile = src_dir / "Dockerfile"
    has_pyproject = (src_dir / "pyproject.toml").exists()
    has_uv_lock = (src_dir / "uv.lock").exists()
    has_requirements = (src_dir / "requirements.txt").exists()
    has_package_json = (src_dir / "package.json").exists()

    entrypoint = _detect_python_entrypoint(src_dir) if has_pyproject else None

    if has_pyproject and has_uv_lock:
        # uv ベース: uv sync でインストール、uv run で実行
        cmd_line = f'CMD ["uv", "run", "{entrypoint}"]' if entrypoint else 'CMD ["uv", "run", "python", "-m", "server"]'
        content = (
            "FROM python:3.12-slim\n"
            "WORKDIR /app\n"
            "RUN pip install --no-cache-dir uv\n"
            "COPY . .\n"
            "RUN uv sync --frozen --no-dev\n"
            f"{cmd_line}\n"
        )
        log("  Dockerfile を自動生成しました（uv ベース）")

    elif has_pyproject:
        # pip install . ベース
        cmd_line = f'CMD ["{entrypoint}"]' if entrypoint else 'CMD ["python", "-m", "server"]'
        content = (
            "FROM python:3.12-slim\n"
            "WORKDIR /app\n"
            "COPY . .\n"
            "RUN pip install --no-cache-dir .\n"
            f"{cmd_line}\n"
        )
        log("  Dockerfile を自動生成しました（pip install . ベース）")

    elif has_requirements:
        # requirements.txt ベース
        content = (
            "FROM python:3.12-slim\n"
            "WORKDIR /app\n"
            "COPY . .\n"
            "RUN pip install --no-cache-dir -r requirements.txt\n"
            'CMD ["python", "-m", "server"]\n'
        )
        log("  Dockerfile を自動生成しました（requirements.txt ベース）")

    elif has_package_json:
        # Node.js ベース
        content = (
            "FROM node:20-slim\n"
            "WORKDIR /app\n"
            "COPY . .\n"
            "RUN npm install --production\n"
            'CMD ["node", "index.js"]\n'
        )
        log("  Dockerfile を自動生成しました（Node.js ベース）")

    else:
        raise RuntimeError(
            "Dockerfile が見つからず、自動生成もできません。"
            "pyproject.toml / requirements.txt / package.json のいずれかが必要です。"
        )

    dockerfile.write_text(content, encoding="utf-8")


def _build_image(
    name: str, src_dir: Path, log: LogFn, context_dir: Path | None = None
) -> None:
    """Docker イメージをビルドする。

    Dockerfile がない場合はプロジェクト構成から自動生成する。
    サブディレクトリ指定時はリポジトリルートをコンテキストにして Dockerfile を指定する
    (デファクトスタンダード: modelcontextprotocol/servers 等の COPY src/xxx /app 形式)。
    """
    # Dockerfile がなければ自動生成
    dockerfile = src_dir / "Dockerfile"
    if not dockerfile.exists():
        _generate_dockerfile(src_dir, log)

    # FastMCP 3.x 互換: enabled= パラメータを除去
    _patch_fastmcp_enabled(src_dir, log)

    # socket-proxy 環境では BuildKit（gRPC）が使えないため、レガシービルダーを使用
    # Dockerfile 内の --mount オプション（BuildKit 専用）を除去して互換性を確保
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
    """コンテナのヘルスチェックを行う。HTTP 応答を確認する。"""
    import requests as req_lib

    log(f"ヘルスチェック中 (localhost:{port}) ...")
    for i in range(1, HEALTH_CHECK_RETRIES + 1):
        # コンテナが Running か確認
        state = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", name],
            capture_output=True, text=True,
        ).stdout.strip()
        if state != "true":
            log(f"  待機中... ({i}/{HEALTH_CHECK_RETRIES})")
            time.sleep(HEALTH_CHECK_INTERVAL)
            continue

        # HTTP 応答を確認（/mcp または /sse に接続を試行）
        # HEALTH_CHECK_HOST を使用（Docker Compose ではコンテナ内から
        # CRUCIBLE_HOST に到達できないため別の値を使う場合がある）
        # 404 でもサーバーが応答していれば OK
        for path in ("/mcp", "/sse"):
            try:
                resp = req_lib.get(f"http://{HEALTH_CHECK_HOST}:{port}{path}", timeout=2)
                log(f"  ヘルスチェック OK — HTTP 応答確認 ({path} → {resp.status_code}) ({i}/{HEALTH_CHECK_RETRIES})")
                return
            except req_lib.exceptions.Timeout:
                # タイムアウト = SSE ストリーム接続中（応答あり）
                log(f"  ヘルスチェック OK — HTTP 応答確認 ({path} → streaming) ({i}/{HEALTH_CHECK_RETRIES})")
                return
            except req_lib.exceptions.ConnectionError:
                pass  # サーバーまだ準備中

        log(f"  HTTP 未応答、待機中... ({i}/{HEALTH_CHECK_RETRIES})")
        time.sleep(HEALTH_CHECK_INTERVAL)

    raise RuntimeError(
        f"ヘルスチェックがタイムアウトしました。ログ確認: docker logs {name}"
    )


def _register_dify(
    name: str, static_ip: str, port: int,
    icon: str, display_name: str,
    log: LogFn,
) -> tuple[bool, str]:
    """Dify に MCP ツールプロバイダーとして登録する。

    Returns:
        (dify_ok, endpoint_path): 登録成功フラグと検出されたエンドポイントパス
    """
    # デフォルトのエンドポイントパス
    detected_path = "/sse"

    if not (DIFY_EMAIL and DIFY_PASSWORD):
        log("DIFY_EMAIL / DIFY_PASSWORD が未設定のため Dify 登録をスキップします")
        return False, detected_path

    import http.client
    import json as _json
    import urllib.parse
    import requests as req_lib

    # ログイン — requests で行う (レスポンスのクッキーを読むだけなので問題なし)
    # Dify はパスワードを Base64 エンコードして受け取る
    import base64 as _b64
    encoded_password = _b64.b64encode(DIFY_PASSWORD.encode()).decode()
    try:
        login_resp = req_lib.post(
            f"{DIFY_API_BASE}/login",
            json={"email": DIFY_EMAIL, "password": encoded_password},
            timeout=15,
        )
        result = login_resp.json()
        if result.get("result") != "success":
            log(f"Dify ログイン失敗: {result}")
            return False, detected_path
    except Exception as e:
        log(f"Dify ログイン失敗: {e}")
        return False, detected_path

    # Set-Cookie から直接トークン取得
    access_token = login_resp.cookies.get("access_token", "")
    csrf_token   = login_resp.cookies.get("csrf_token", "")
    if not access_token:
        log("Dify ログイン失敗: access_token クッキーが見つかりません")
        return False, detected_path

    # エンドポイント URL の決定: トランスポート自動検出
    # /mcp を先にチェック（即座にレスポンスが返る）→ /sse はストリームでハングするため後
    # ヘルスチェック同様、HEALTH_CHECK_HOST:port でプローブし、
    # Dify 登録用の URL は static_ip:8000 で構築する
    dify_base_url = f"http://{static_ip}:8000"
    probe_base_url = f"http://{HEALTH_CHECK_HOST}:{port}"
    server_url = f"{dify_base_url}/sse"  # デフォルトは SSE
    try:
        # /mcp を確認（Streamable HTTP: 即座にレスポンスが返る）
        mcp_resp = req_lib.get(f"{probe_base_url}/mcp", timeout=3)
        if mcp_resp.status_code != 404:
            server_url = f"{dify_base_url}/mcp"
            detected_path = "/mcp"
            log(f"  トランスポート: Streamable HTTP (/mcp)")
        else:
            log(f"  トランスポート: SSE (/sse)")
    except Exception:
        # /mcp に接続できない場合は /sse をデフォルトで使用
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
            return False, detected_path
        log(f"Dify 登録完了: {name} ({server_url})")
        return True, detected_path
    except Exception as e:
        log(f"Dify 登録失敗 (手動で登録してください — URL: {server_url}): {e}")
        return False, detected_path


def register_simple(req: RegisterRequest, log: LogFn) -> ServerRecord:
    """CLI/Library・Skill の軽量登録（Docker デプロイなし）。

    メタデータのみをレジストリに保存する。
    """
    if not req.name:
        raise RuntimeError("CLI/Library・Skill の登録には name が必須です")

    log(f"=== {req.tool_type} 登録: {req.name} ===")

    # 重複チェック
    existing = registry.get(req.name)
    if existing:
        if existing.status not in ("error", "registered"):
            raise RuntimeError(f"名前 '{req.name}' は既に登録されています")
        log(f"  既存レコード (status={existing.status}) を上書きします")

    record = ServerRecord(
        name=req.name,
        display_name=req.display_name or req.name,
        description=req.description,
        icon=req.icon,
        github_url=req.github_url,
        branch=req.branch,
        subdir=req.subdir,
        tool_type=req.tool_type,
        install_command=req.install_command,
        content=req.content,
        group=req.group,
        port=0,
        static_ip="",
        status="registered",
        error_message=None,
    )
    registry.upsert(record)

    log(f"  ツール種別: {req.tool_type}")
    if req.install_command:
        log(f"  インストール: {req.install_command}")
    if req.content:
        log(f"  スキル本文: {len(req.content)} 文字")
    log(f"=== 登録完了: {req.name} ===")
    return record


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
        commit_hash = _get_local_head(clone_dir)

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
            tool_type=req.tool_type,
            group=req.group,
            port=0,
            static_ip="",
            status="deploying",
        )
        registry.upsert(provisional)

        # ツール種別の自動検出（リクエストでデフォルトのまま & Dockerfile 自動生成前に判定）
        if req.tool_type == "mcp_server":
            detected_type = _detect_tool_type(build_dir)
            if detected_type != "mcp_server":
                req.tool_type = detected_type
                log(f"  ツール種別を自動検出: {detected_type}")

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
        dify_ok, endpoint_path = _register_dify(
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
        tool_type=req.tool_type,
        group=req.group,
        port=port,
        static_ip=static_ip,
        status="running",
        dify_registered=dify_ok,
        endpoint_path=endpoint_path,
        error_message=None,
        github_token_enc=token_enc,
        auto_update=req.auto_update,
        last_commit_hash=commit_hash,
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
        # name は models.py のバリデータで [a-z0-9-] のみ許可済みだが、
        # 防御的にシングルクォートをエスケープして SQL インジェクションを防ぐ
        safe_name = name.replace("'", "''")
        result = subprocess.run(
            [
                "docker", "exec", DIFY_DB_CONTAINER,
                "psql", "-U", DIFY_DB_USER, "-d", DIFY_DB_NAME,
                "-c", f"DELETE FROM tool_mcp_providers WHERE name = '{safe_name}';",
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


def stop(name: str, log: LogFn) -> None:
    """コンテナを停止する（レジストリのレコードは保持）。"""
    log(f"コンテナ停止: {name}")
    subprocess.run(["docker", "stop", name], capture_output=True)

    record = registry.get(name)
    if record:
        record.status = "stopped"
        record.error_message = None
        registry.upsert(record)
    log(f"停止完了: {name}")


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


def dify_connect(name: str, log: LogFn) -> None:
    """既存サーバーを Dify に登録（または再登録）する。"""
    record = registry.get(name)
    if not record:
        raise RuntimeError(f"サーバーが見つかりません: {name}")
    if record.status != "running":
        raise RuntimeError(f"サーバーが running 状態ではありません (現在: {record.status})")

    log(f"=== Dify 接続: {name} ===")
    dify_ok, endpoint_path = _register_dify(
        name, record.static_ip, record.port,
        record.icon, record.display_name, log,
    )
    if not dify_ok:
        raise RuntimeError("Dify への登録に失敗しました")

    record.dify_registered = dify_ok
    record.endpoint_path = endpoint_path
    registry.upsert(record)
    log(f"=== Dify 接続完了: {name} ===")


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
        # deploying / error / registered はステータス同期をスキップ
        # deploying: バックグラウンドで処理中
        # error: ユーザーが明示的に操作（リトライ/削除）するまで保持
        # registered: CLI/Library・Skill はコンテナを持たない
        if record.status in ("deploying", "error", "registered"):
            continue
        new_status = "running" if record.name in running else "stopped"
        if record.status != new_status:
            record.status = new_status
            registry.upsert(record)


def _resolve_token(record: ServerRecord) -> str:
    """ServerRecord から復号済み GitHub Token を取得する。"""
    if record.github_token_enc:
        return decrypt_token(record.github_token_enc)
    return GITHUB_TOKEN


def update(name: str, log: LogFn) -> ServerRecord:
    """登録済み MCP サーバーを最新のコミットで再ビルド・再起動する。

    既存のポート・IP・設定を維持したまま、コンテナのみ更新する。
    """
    record = registry.get(name)
    if not record:
        raise RuntimeError(f"サーバーが見つかりません: {name}")

    log(f"=== MCP サーバー更新開始: {name} ===")

    token = _resolve_token(record)

    # リモートの最新コミットを確認
    remote_head = _get_remote_head(record.github_url, record.branch, token)
    if not remote_head:
        raise RuntimeError(
            f"リモートリポジトリの HEAD を取得できません: {record.github_url} ({record.branch})"
        )

    if remote_head == record.last_commit_hash:
        log(f"変更なし ({remote_head[:7]}) — 更新をスキップ")
        return record

    log(f"更新検出: {record.last_commit_hash[:7] if record.last_commit_hash else '(不明)'} → {remote_head[:7]}")

    TOTAL = 5
    work_dir = Path(tempfile.mkdtemp(prefix=f"crucible-update-{name}-"))
    try:
        # クローン
        _step(1, TOTAL, f"GitHub クローン: {record.github_url} ({record.branch})", log)
        clone_dir = work_dir / name
        clone_req = RegisterRequest(
            name=name,
            github_url=record.github_url,
            branch=record.branch,
            subdir=record.subdir,
        )
        _clone_repo(clone_req, clone_dir, log, stored_token_enc=record.github_token_enc)
        commit_hash = _get_local_head(clone_dir)

        build_dir = clone_dir / record.subdir if record.subdir else clone_dir

        # トランスポート検出
        transport = _detect_transport(build_dir, "auto")

        # ビルド
        _step(2, TOTAL, "Docker イメージをビルド中...", log)
        _build_image(
            name, build_dir, log,
            context_dir=clone_dir if record.subdir else None,
        )

        # stdio の場合は mcp-proxy でラップ
        if transport == "stdio":
            _wrap_with_mcp_proxy(name, log)

        # コンテナ再起動（既存コンテナを停止→削除→起動）
        _step(3, TOTAL, "コンテナを再起動中...", log)

        # 既存のコンテナから環境変数を取得
        env_json = subprocess.run(
            ["docker", "inspect", "--format", "{{json .Config.Env}}", name],
            capture_output=True, text=True,
        )
        env_vars: dict[str, str] = {}
        if env_json.returncode == 0:
            import json as _json
            for entry in _json.loads(env_json.stdout.strip()):
                k, _, v = entry.partition("=")
                # Docker 内部の環境変数（PATH 等）は除外
                if k not in ("PATH", "HOME", "HOSTNAME", "LANG", "TERM"):
                    env_vars[k] = v

        _start_container(name, record.port, record.static_ip, env_vars, log)

        # ヘルスチェック
        _step(4, TOTAL, "ヘルスチェック...", log)
        _health_check(name, record.port, log)

        # Dify 再登録（既に登録済みの場合のみ）
        _step(5, TOTAL, "Dify への登録確認...", log)
        if record.dify_registered:
            dify_ok, endpoint_path = _register_dify(
                name, record.static_ip, record.port,
                record.icon, record.display_name, log,
            )
            record.dify_registered = dify_ok
            record.endpoint_path = endpoint_path
        else:
            log("  Dify 未登録のためスキップ")

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    # レジストリ更新
    record.status = "running"
    record.error_message = None
    record.last_commit_hash = commit_hash
    registry.upsert(record)

    log(f"=== 更新完了: {name} ({commit_hash[:7]}) ===")
    return record


def check_and_update_all(log: LogFn) -> list[str]:
    """auto_update が有効な全サーバーの更新をチェックし、更新があれば再デプロイする。

    Returns:
        更新されたサーバー名のリスト
    """
    updated: list[str] = []
    servers = registry.get_all()
    auto_update_servers = [s for s in servers if s.auto_update and s.status == "running"]

    if not auto_update_servers:
        log("自動更新対象のサーバーはありません")
        return updated

    log(f"自動更新チェック: {len(auto_update_servers)} サーバー")

    for record in auto_update_servers:
        try:
            token = _resolve_token(record)
            remote_head = _get_remote_head(record.github_url, record.branch, token)

            if not remote_head:
                log(f"  {record.name}: リモート HEAD 取得失敗 — スキップ")
                continue

            if remote_head == record.last_commit_hash:
                log(f"  {record.name}: 変更なし ({remote_head[:7]})")
                continue

            log(f"  {record.name}: 更新あり ({record.last_commit_hash[:7] if record.last_commit_hash else '?'} → {remote_head[:7]})")
            update(record.name, log)
            updated.append(record.name)

        except Exception as e:
            log(f"  {record.name}: 更新失敗 — {e}")
            # エラーでも他のサーバーの更新は続ける
            rec = registry.get(record.name)
            if rec:
                rec.status = "error"
                rec.error_message = f"自動更新失敗: {e}"
                registry.upsert(rec)

    log(f"自動更新完了: {len(updated)} サーバーを更新")
    return updated
