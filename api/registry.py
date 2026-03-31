"""
MCP Registry API — レジストリファイル管理
ポート・固定 IP の割り当て、servers.json の読み書き
"""
from __future__ import annotations

import fcntl
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Optional

from models import ServerRecord

# レジストリファイルのパス (環境変数で上書き可)
# デフォルトはプロジェクト直下の data/ — Docker では REGISTRY_FILE 環境変数で上書き
_DEFAULT_REGISTRY = str(Path(__file__).resolve().parent / "data" / "servers.json")
REGISTRY_PATH = Path(os.environ.get("REGISTRY_FILE", _DEFAULT_REGISTRY))

# ポート・IP 割り当て範囲
# 公式 (group=default):    port 8001-8099 / IP 172.20.0.11-99
# ユーザー (group=user):   port 8100-8199 / IP 172.20.0.101-199
OFFICIAL_PORT_START = 8001
OFFICIAL_PORT_END   = 8099
USER_PORT_START     = 8100
USER_PORT_END       = 8199

DOCKER_IP_PREFIX = "172.20.0."
OFFICIAL_IP_START = 11
OFFICIAL_IP_END   = 99
USER_IP_START     = 101
USER_IP_END       = 199


def load() -> dict[str, dict]:
    """レジストリを読み込む。ファイルが存在しない場合は空 dict を返す。"""
    if not REGISTRY_PATH.exists():
        return {}
    with REGISTRY_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save(data: dict[str, dict]) -> None:
    """レジストリをファイルに書き込む (flock でロック)。"""
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    lock_path = str(REGISTRY_PATH) + ".lock"
    with open(lock_path, "w") as lock_f:
        fcntl.flock(lock_f, fcntl.LOCK_EX)
        with REGISTRY_PATH.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        fcntl.flock(lock_f, fcntl.LOCK_UN)


def get_all() -> list[ServerRecord]:
    """全サーバーレコードを返す。"""
    return [ServerRecord(**v) for v in load().values()]


def get(name: str) -> Optional[ServerRecord]:
    """指定名のサーバーレコードを返す。存在しない場合は None。"""
    data = load()
    if name in data:
        return ServerRecord(**data[name])
    return None


def upsert(record: ServerRecord) -> None:
    """サーバーレコードを作成または更新する。"""
    from datetime import UTC, datetime

    data = load()
    rec_dict = record.model_dump()
    rec_dict["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    data[record.name] = rec_dict
    save(data)


def delete(name: str) -> bool:
    """サーバーレコードを削除する。削除できた場合は True。"""
    data = load()
    if name not in data:
        return False
    del data[name]
    save(data)
    return True


def exists(name: str) -> bool:
    return name in load()


def _docker_used_ports() -> set[int]:
    """Docker が実際にバインドしているホスト側ポートを返す。"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Ports}}"],
            capture_output=True, text=True,
        )
        ports: set[int] = set()
        for line in result.stdout.splitlines():
            # 例: "0.0.0.0:8001->8000/tcp" や "127.0.0.1:8001->8000/tcp"
            for m in re.finditer(r":(\d+)->", line):
                ports.add(int(m.group(1)))
        return ports
    except Exception:
        return set()


def next_port(group: str) -> int:
    """グループに応じて次の空きポートを返す。
    servers.json と Docker の実使用状況の両方をチェックする。"""
    data = load()
    used_ports = {v["port"] for v in data.values()} | _docker_used_ports()

    if group == "default":
        port_range = range(OFFICIAL_PORT_START, OFFICIAL_PORT_END + 1)
    else:
        port_range = range(USER_PORT_START, USER_PORT_END + 1)

    for port in port_range:
        if port not in used_ports:
            return port

    raise RuntimeError(f"グループ '{group}' の空きポートがありません")


def _docker_used_ips() -> set[str]:
    """mcp-net に接続中のコンテナの IP アドレスを返す。"""
    try:
        result = subprocess.run(
            ["docker", "network", "inspect", "mcp-net",
             "--format", "{{range .Containers}}{{.IPv4Address}} {{end}}"],
            capture_output=True, text=True,
        )
        ips: set[str] = set()
        for token in result.stdout.split():
            ip = token.split("/")[0]  # "172.20.0.11/24" → "172.20.0.11"
            if ip:
                ips.add(ip)
        return ips
    except Exception:
        return set()


def next_static_ip(group: str) -> str:
    """グループに応じて次の空き固定 IP を返す。
    servers.json と mcp-net の実使用状況の両方をチェックする。"""
    data = load()
    used_ips = {v["static_ip"] for v in data.values()} | _docker_used_ips()

    if group == "default":
        ip_range = range(OFFICIAL_IP_START, OFFICIAL_IP_END + 1)
    else:
        ip_range = range(USER_IP_START, USER_IP_END + 1)

    for i in ip_range:
        ip = f"{DOCKER_IP_PREFIX}{i}"
        if ip not in used_ips:
            return ip

    raise RuntimeError(f"グループ '{group}' の空き固定 IP がありません")
