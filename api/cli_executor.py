"""CLI/Library ツールのインストールと実行

Registry に登録された CLI/Library を動的にインストールし、
API エンドポイント経由で実行する。

プロセス分離: すべての CLI 実行は子プロセスで行い、
タイムアウト・同時実行制限で Registry 本体への影響を防ぐ。
"""

from __future__ import annotations

import asyncio
import logging
import shlex
from contextlib import asynccontextmanager
from typing import AsyncIterator

logger = logging.getLogger(__name__)

# インストールコマンドの許可プレフィックス
ALLOWED_INSTALL_PREFIXES = (
    "pip install",
    "pip3 install",
    "uv pip install",
    "uv add",
    "npm install -g",
    "npx ",
)

# タイムアウト設定（秒）
INSTALL_TIMEOUT = 120
EXECUTE_TIMEOUT = 60

# 同時実行制限（障害ドメイン分離）
MAX_CONCURRENT_EXECUTIONS = 3
_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    """イベントループごとに Semaphore を初期化する"""
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(MAX_CONCURRENT_EXECUTIONS)
    return _semaphore


@asynccontextmanager
async def _acquire_slot() -> AsyncIterator[None]:
    """実行スロットを取得する。満杯なら待機する。"""
    sem = _get_semaphore()
    await sem.acquire()
    try:
        yield
    finally:
        sem.release()


def _validate_install_command(cmd: str) -> None:
    """インストールコマンドが許可パターンに一致するか検証する"""
    if not cmd.strip():
        raise ValueError("install_command が空です")
    if not any(cmd.strip().startswith(p) for p in ALLOWED_INSTALL_PREFIXES):
        raise ValueError(
            f"許可されていないインストールコマンド: {cmd!r}\n"
            f"許可パターン: {', '.join(ALLOWED_INSTALL_PREFIXES)}"
        )


class CliExecutor:
    """CLI/Library ツールのインストールと実行を管理する

    すべてのコマンドは子プロセス (subprocess) で実行されるため、
    CLI のクラッシュ・メモリリーク・暴走が Registry 本体に波及しない。
    同時実行数は MAX_CONCURRENT_EXECUTIONS で制限する。
    """

    def __init__(self) -> None:
        self._installed: set[str] = set()

    async def ensure_installed(self, name: str, install_command: str) -> str:
        """ツールが未インストールならインストールする（冪等）"""
        if name in self._installed:
            return f"{name} はインストール済みです"

        _validate_install_command(install_command)

        logger.info("CLI ツールをインストール: %s (%s)", name, install_command)
        async with _acquire_slot():
            try:
                proc = await asyncio.create_subprocess_shell(
                    install_command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=INSTALL_TIMEOUT
                )
            except TimeoutError:
                msg = f"{name} のインストールがタイムアウトしました ({INSTALL_TIMEOUT}秒)"
                logger.error(msg)
                return msg

        if proc.returncode == 0:
            self._installed.add(name)
            logger.info("CLI ツールのインストール完了: %s", name)
            return f"{name} のインストールが完了しました"

        error_output = stderr.decode(errors="replace").strip()
        msg = f"{name} のインストールに失敗しました (exit={proc.returncode}): {error_output[:500]}"
        logger.error(msg)
        return msg

    async def execute_with_template(
        self, name: str, run_command: str, args: dict[str, str],
    ) -> str:
        """run_command テンプレートに引数を埋め込んで実行する

        Args:
            name: ツール名（ログ用）
            run_command: コマンドテンプレート（例: "arxiv-mcp search --query {query}"）
            args: テンプレート変数の値（例: {"query": "quantum computing"}）
        """
        safe_args = {k: shlex.quote(v) for k, v in args.items()}
        try:
            full_cmd = run_command.format(**safe_args)
        except KeyError as e:
            return f"エラー: run_command のテンプレート変数 {e} が不足しています"

        return await self.execute(name, full_cmd)

    async def execute(self, name: str, command: str, arguments: str = "") -> str:
        """CLI コマンドを実行して結果を返す

        子プロセスで実行し、タイムアウトで暴走を防止する。
        同時実行数はセマフォで制限し、リソース競合を防ぐ。
        """
        if arguments:
            safe_args = shlex.quote(arguments)
            full_cmd = f"{command} {safe_args}"
        else:
            full_cmd = command

        logger.info("CLI ツールを実行: %s — %s", name, full_cmd[:200])
        async with _acquire_slot():
            try:
                proc = await asyncio.create_subprocess_shell(
                    full_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=EXECUTE_TIMEOUT
                )
            except TimeoutError:
                msg = f"コマンドがタイムアウトしました ({EXECUTE_TIMEOUT}秒): {full_cmd[:200]}"
                logger.error(msg)
                return msg

        out = stdout.decode(errors="replace").strip()
        err = stderr.decode(errors="replace").strip()

        if proc.returncode != 0:
            return f"エラー (exit={proc.returncode}):\n{err[:2000]}\n{out[:2000]}"

        result = out
        if err:
            result += f"\n\n[stderr]\n{err[:1000]}"
        return result[:4000] if result else "(出力なし)"


# シングルトンインスタンス
cli_executor = CliExecutor()
