"""
MCP Registry API — Pydantic モデル定義
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
import re


ToolType = Literal["mcp_server", "cli_library", "skill"]


class RegisterRequest(BaseModel):
    """新規 MCP サーバー登録リクエスト"""

    name: Optional[str] = Field(None, description="サーバー名 (省略時は mcp.json から自動補完)")
    display_name: Optional[str] = Field(None, description="表示名 (省略時は mcp.json から自動補完)")
    description: str = Field("", description="機能説明 (省略時は mcp.json から自動補完)")
    icon: str = Field("🔧", description="絵文字アイコン")
    github_url: str = Field("", description="GitHub リポジトリ URL (skill 以外は必須)")
    branch: str = Field("main", description="ブランチ名")
    tool_type: ToolType = Field(
        "mcp_server",
        description="ツール種別 (mcp_server / cli_library / skill)",
    )
    group: Literal["default", "user"] = Field(
        "user", description="グループ (default=公式 / user=ユーザー投稿)"
    )
    subdir: str = Field(
        "", description="リポジトリ内のサブディレクトリ (モノリポ用)"
    )
    github_token: str = Field(
        "", description="GitHub Personal Access Token (プライベートリポジトリ用)"
    )
    transport: Literal["auto", "sse", "stdio"] = Field(
        "auto",
        description="MCP トランスポート (auto=自動検出 / sse=HTTP SSE / stdio=標準入出力→supergateway で SSE 化)",
    )
    dify_auto_register: bool = Field(True, description="Dify へ自動登録するか")
    auto_update: bool = Field(
        False, description="GitHub リポジトリ更新時に自動で再デプロイするか"
    )
    install_command: str = Field(
        "", description="インストールコマンド (CLI/Library 用。例: pip install arxiv-latex-mcp)"
    )
    content: str = Field(
        "", description="スキル定義のマークダウン本文 (skill 専用)"
    )
    cli_execution: dict = Field(
        default_factory=dict,
        description="CLI 実行情報 (cli_library 用。run_command, output_format, install_command)",
    )
    env_vars: dict[str, str] = Field(
        default_factory=dict, description="コンテナに渡す環境変数"
    )

    @model_validator(mode="after")
    def validate_by_tool_type(self) -> "RegisterRequest":
        """tool_type に応じた必須フィールドを検証する。"""
        if self.tool_type == "skill":
            if not self.content.strip():
                raise ValueError("skill の登録にはマークダウン本文 (content) が必須です")
            if not self.name:
                raise ValueError("skill の登録には name が必須です")
        else:
            if not self.github_url:
                raise ValueError("github_url は必須です")
            if not re.match(r"^https://github\.com/[\w./-]+$", self.github_url):
                raise ValueError("github_url は https://github.com/... 形式で入力してください")
        return self

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$", v):
            raise ValueError(
                "name は小文字英数字とハイフンのみ使用可 (3〜50 文字)"
            )
        return v

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str) -> str:
        # git ref として安全な文字のみ許可 (シェルメタキャラクタ・パス走査を防ぐ)
        if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,98}[a-zA-Z0-9]$", v) and not re.match(r"^[a-zA-Z0-9]$", v):
            raise ValueError("branch 名に使用できない文字が含まれています")
        if ".." in v or v.startswith("/") or v.endswith("/"):
            raise ValueError("branch 名にパス走査文字 (.., 先頭/末尾スラッシュ) は使用できません")
        return v

    @field_validator("env_vars")
    @classmethod
    def validate_env_vars(cls, v: dict) -> dict:
        # 環境変数名: 英字またはアンダースコア始まり、英数字とアンダースコアのみ
        for key in v:
            if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,127}$", key):
                raise ValueError(
                    f"環境変数名が不正です: '{key}'"
                    " (英字/アンダースコア始まり、英数字とアンダースコアのみ使用可)"
                )
        return v


class ServerRecord(BaseModel):
    """レジストリに保存されるサーバー情報"""

    name: str
    display_name: str
    description: str
    icon: str
    github_url: str
    branch: str
    subdir: str = ""
    tool_type: ToolType = "mcp_server"
    group: str
    install_command: str = ""
    content: str = Field("", description="スキル定義のマークダウン本文 (skill 専用)")
    cli_execution: dict = Field(
        default_factory=dict,
        description="CLI 実行情報 (cli_library 用。run_command, output_format, install_command)",
    )
    port: int
    static_ip: str
    status: Literal["running", "stopped", "error", "deploying", "registered"] = "deploying"
    created_at: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat().replace("+00:00", "Z")
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat().replace("+00:00", "Z")
    )
    error_message: Optional[str] = None
    dify_registered: bool = False
    endpoint_path: str = Field(
        "/sse", description="MCP エンドポイントパス (/sse or /mcp)"
    )
    github_token_enc: str = Field(
        "", description="暗号化済み GitHub Token (AES-256-GCM + base64url)"
    )
    auto_update: bool = Field(
        False, description="GitHub リポジトリ更新時に自動で再デプロイするか"
    )
    last_commit_hash: str = Field(
        "", description="最後にデプロイしたコミットハッシュ"
    )


class DeployJob(BaseModel):
    """デプロイジョブの状態"""

    job_id: str
    server_name: str
    status: Literal["pending", "running", "success", "error"] = "pending"
    logs: list[str] = Field(default_factory=list)
    created_at: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat().replace("+00:00", "Z")
    )
    finished_at: Optional[str] = None


class LogsResponse(BaseModel):
    """ログポーリング レスポンス"""

    job_id: str
    status: str
    logs: list[str]
    total: int


class CliRunRequest(BaseModel):
    """CLI 実行リクエスト"""

    name: str = Field(..., description="実行対象のツール名（Registry 登録名）")
    command: str = Field("", description="直接実行するコマンド (run_command テンプレートより優先)")
    args: dict[str, str] = Field(
        default_factory=dict,
        description="run_command テンプレートに埋め込む引数",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name は必須です")
        return v.strip()


class CliRunResponse(BaseModel):
    """CLI 実行レスポンス"""

    name: str
    success: bool
    output: str
    install_message: str = ""
