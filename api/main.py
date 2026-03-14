"""
MCP Registry API — FastAPI バックエンド

エンドポイント一覧:
  GET    /api/servers                   — サーバー一覧
  POST   /api/servers                   — 新規登録 (デプロイジョブ起動)
  GET    /api/servers/{name}            — サーバー詳細
  DELETE /api/servers/{name}            — サーバー削除
  POST   /api/servers/{name}/restart    — サーバー再起動
  GET    /api/jobs/{job_id}             — ジョブ状態取得
  GET    /api/jobs/{job_id}/logs        — ログポーリング (offset パラメータ付き)
"""
from __future__ import annotations

import logging
import os
import threading
import uuid
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader

import deployer
import registry
from models import (
    DeployJob,
    LogsResponse,
    RegisterRequest,
    ServerRecord,
)

logger = logging.getLogger(__name__)

# ==============================================================================
# API キー認証
# ==============================================================================
_REGISTRY_API_KEY = os.environ.get("REGISTRY_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

if not _REGISTRY_API_KEY:
    logger.warning(
        "REGISTRY_API_KEY が未設定です。Registry API は無認証で動作します。"
        " 本番環境では必ず .env に REGISTRY_API_KEY を設定してください。"
    )


async def _verify_api_key(key: str = Security(_api_key_header)) -> None:
    """X-API-Key ヘッダーを検証する。REGISTRY_API_KEY 未設定時はスキップ。"""
    if _REGISTRY_API_KEY and key != _REGISTRY_API_KEY:
        raise HTTPException(status_code=401, detail="APIキーが無効です")


# ==============================================================================
# アプリ初期化
# ==============================================================================
app = FastAPI(
    title="MCP Registry API",
    description="Crucible — MCP サーバーの登録・管理 API",
    version="1.0.0",
    dependencies=[Depends(_verify_api_key)],
)

# CORS 設定: 環境変数 CRUCIBLE_CORS_ORIGINS でカスタマイズ可能
# 未設定時はデフォルトのオリジンを使用
_cors_env = os.environ.get("CRUCIBLE_CORS_ORIGINS", "")
_cors_origins = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env
    else ["http://localhost:8081", "http://127.0.0.1:8081"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["X-API-Key", "Content-Type"],
)

# ジョブストア (メモリ内; 再起動で消える)
_jobs: dict[str, DeployJob] = {}
_jobs_lock = threading.Lock()


# ==============================================================================
# ユーティリティ
# ==============================================================================
def _get_job(job_id: str) -> DeployJob:
    with _jobs_lock:
        if job_id not in _jobs:
            raise HTTPException(status_code=404, detail=f"ジョブが見つかりません: {job_id}")
        return _jobs[job_id]


def _append_log(job_id: str, message: str) -> None:
    ts = datetime.utcnow().strftime("%H:%M:%S")
    line = f"[{ts}] {message}"
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].logs.append(line)


def _set_job_status(
    job_id: str,
    status: str,
    error_message: Optional[str] = None,
) -> None:
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].status = status  # type: ignore[assignment]
            _jobs[job_id].finished_at = datetime.utcnow().isoformat() + "Z"
            if error_message:
                _jobs[job_id].logs.append(f"[ERROR] {error_message}")


# ==============================================================================
# サーバー一覧・詳細
# ==============================================================================
@app.get("/api/servers", response_model=list[ServerRecord])
def list_servers() -> list[ServerRecord]:
    """登録済み MCP サーバーの一覧を返す。"""
    deployer.refresh_statuses()
    return registry.get_all()


@app.get("/api/servers/{name}", response_model=ServerRecord)
def get_server(name: str) -> ServerRecord:
    """指定名のサーバー詳細を返す。"""
    record = registry.get(name)
    if not record:
        raise HTTPException(status_code=404, detail=f"サーバーが見つかりません: {name}")
    return record


# ==============================================================================
# サーバー登録 (非同期デプロイ)
# ==============================================================================
@app.post("/api/servers", response_model=DeployJob, status_code=202)
def register_server(req: RegisterRequest) -> DeployJob:
    """
    新規 MCP サーバーを登録する。
    デプロイはバックグラウンドで実行され、job_id でステータスを確認できる。
    """
    # 名前が指定されている場合のみ重複チェック（未指定時は mcp.json から解決）
    # error / deploying 状態のレコードは再デプロイを許可する
    if req.name and registry.exists(req.name):
        existing = registry.get(req.name)
        if existing and existing.status not in ("error", "deploying"):
            raise HTTPException(
                status_code=409, detail=f"サーバー名 '{req.name}' は既に登録されています"
            )

    # ジョブ作成（名前が未解決の場合は仮置き）
    job_id = str(uuid.uuid4())
    job = DeployJob(
        job_id=job_id,
        server_name=req.name or "(pending)",
        status="pending",
    )
    with _jobs_lock:
        _jobs[job_id] = job

    # デプロイをバックグラウンドスレッドで実行
    def _run_deploy() -> None:
        _set_job_status(job_id, "running")
        log_fn = lambda msg: _append_log(job_id, msg)

        try:
            deployer.deploy(req, log_fn)
            # 名前解決後にジョブの server_name を更新
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id].server_name = req.name or "(pending)"
            _set_job_status(job_id, "success")
        except Exception as e:
            # エラー時はレジストリのステータスを更新（名前が解決済みの場合）
            if req.name:
                rec = registry.get(req.name)
                if rec:
                    rec.status = "error"
                    rec.error_message = str(e)
                    registry.upsert(rec)
            _set_job_status(job_id, "error", str(e))

    thread = threading.Thread(target=_run_deploy, daemon=True)
    thread.start()

    with _jobs_lock:
        return _jobs[job_id]


# ==============================================================================
# サーバー削除
# ==============================================================================
@app.delete("/api/servers/{name}", status_code=202)
def delete_server(name: str) -> DeployJob:
    """指定サーバーを停止・削除する。"""
    if not registry.exists(name):
        raise HTTPException(status_code=404, detail=f"サーバーが見つかりません: {name}")

    job_id = str(uuid.uuid4())
    job = DeployJob(job_id=job_id, server_name=name, status="pending")
    with _jobs_lock:
        _jobs[job_id] = job

    def _run_remove() -> None:
        _set_job_status(job_id, "running")
        log_fn = lambda msg: _append_log(job_id, msg)
        try:
            deployer.remove(name, log_fn)
            _set_job_status(job_id, "success")
        except Exception as e:
            _set_job_status(job_id, "error", str(e))

    threading.Thread(target=_run_remove, daemon=True).start()

    with _jobs_lock:
        return _jobs[job_id]


# ==============================================================================
# サーバー再起動
# ==============================================================================
@app.post("/api/servers/{name}/restart", status_code=202)
def restart_server(name: str) -> DeployJob:
    """指定サーバーを再起動する。"""
    if not registry.exists(name):
        raise HTTPException(status_code=404, detail=f"サーバーが見つかりません: {name}")

    job_id = str(uuid.uuid4())
    job = DeployJob(job_id=job_id, server_name=name, status="pending")
    with _jobs_lock:
        _jobs[job_id] = job

    def _run_restart() -> None:
        _set_job_status(job_id, "running")
        log_fn = lambda msg: _append_log(job_id, msg)
        try:
            deployer.restart(name, log_fn)
            _set_job_status(job_id, "success")
        except Exception as e:
            _set_job_status(job_id, "error", str(e))

    threading.Thread(target=_run_restart, daemon=True).start()

    with _jobs_lock:
        return _jobs[job_id]


# ==============================================================================
# ジョブ状態・ログ
# ==============================================================================
@app.get("/api/jobs/{job_id}", response_model=DeployJob)
def get_job(job_id: str) -> DeployJob:
    """ジョブの現在の状態を返す。"""
    return _get_job(job_id)


@app.get("/api/jobs/{job_id}/logs", response_model=LogsResponse)
def get_job_logs(
    job_id: str,
    offset: int = Query(0, ge=0, description="取得開始インデックス"),
) -> LogsResponse:
    """
    ジョブのログを offset から取得する。
    Streamlit 側でポーリングして使う。
    """
    job = _get_job(job_id)
    with _jobs_lock:
        all_logs = list(job.logs)
        status = job.status

    new_logs = all_logs[offset:]
    return LogsResponse(
        job_id=job_id,
        status=status,
        logs=new_logs,
        total=len(all_logs),
    )


# ==============================================================================
# ヘルスチェック
# ==============================================================================
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "mcp-registry-api"}


# ==============================================================================
# 公開設定（UI がベース URL 等を取得するため）
# ==============================================================================
_CRUCIBLE_BASE_URL = os.environ.get("CRUCIBLE_BASE_URL", "http://127.0.0.1")


@app.get("/api/settings")
def get_settings() -> dict:
    """UI が表示に使う公開設定を返す。"""
    return {"base_url": _CRUCIBLE_BASE_URL}
