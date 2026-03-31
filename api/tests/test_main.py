from __future__ import annotations

import sys
import time
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ============================================================
# Authentication
# ============================================================

class TestAuth:
    def test_no_api_key_configured_passes(self, api_client):
        resp = api_client.get("/health")
        assert resp.status_code == 200

    def test_valid_api_key_passes(self, api_client_with_auth):
        resp = api_client_with_auth.get(
            "/health", headers={"X-API-Key": "test-secret-key"}
        )
        assert resp.status_code == 200

    def test_invalid_api_key_returns_401(self, api_client_with_auth):
        resp = api_client_with_auth.get(
            "/health", headers={"X-API-Key": "wrong-key"}
        )
        assert resp.status_code == 401

    def test_missing_api_key_header_returns_401(self, api_client_with_auth):
        resp = api_client_with_auth.get("/health")
        assert resp.status_code == 401


# ============================================================
# GET /health
# ============================================================

class TestHealth:
    def test_health_returns_ok(self, api_client):
        resp = api_client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "service": "mcp-registry-api"}


# ============================================================
# GET /api/settings
# ============================================================

class TestSettings:
    def test_settings_returns_base_url(self, api_client, monkeypatch):
        import main
        monkeypatch.setattr(main, "_CRUCIBLE_BASE_URL", "https://example.com")
        resp = api_client.get("/api/settings")
        assert resp.status_code == 200
        assert resp.json() == {"base_url": "https://example.com"}


# ============================================================
# GET /api/servers
# ============================================================

class TestListServers:
    @patch("main.registry")
    @patch("main.deployer")
    def test_empty_list(self, mock_deployer, mock_registry, api_client):
        mock_registry.get_all.return_value = []
        resp = api_client.get("/api/servers")
        assert resp.status_code == 200
        assert resp.json() == []
        mock_deployer.refresh_statuses.assert_called_once()

    @patch("main.registry")
    @patch("main.deployer")
    def test_returns_records(self, mock_deployer, mock_registry, api_client, sample_server_record):
        rec = sample_server_record()
        mock_registry.get_all.return_value = [rec]
        resp = api_client.get("/api/servers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "test-server"


# ============================================================
# GET /api/servers/{name}
# ============================================================

class TestGetServer:
    @patch("main.registry")
    def test_found(self, mock_registry, api_client, sample_server_record):
        mock_registry.get.return_value = sample_server_record()
        resp = api_client.get("/api/servers/test-server")
        assert resp.status_code == 200
        assert resp.json()["name"] == "test-server"

    @patch("main.registry")
    def test_not_found(self, mock_registry, api_client):
        mock_registry.get.return_value = None
        resp = api_client.get("/api/servers/nonexistent")
        assert resp.status_code == 404


# ============================================================
# POST /api/servers
# ============================================================

class TestRegisterServer:
    @patch("main.deployer")
    @patch("main.registry")
    def test_returns_202_with_job(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        mock_deployer.deploy.return_value = None
        resp = api_client.post("/api/servers", json={
            "name": "new-server",
            "github_url": "https://github.com/owner/repo",
        })
        assert resp.status_code == 202
        body = resp.json()
        assert body["server_name"] == "new-server"
        assert body["status"] in ("pending", "running", "success")
        assert "job_id" in body

    @patch("main.deployer")
    @patch("main.registry")
    def test_duplicate_active_returns_409(self, mock_registry, mock_deployer, api_client, sample_server_record):
        mock_registry.exists.return_value = True
        mock_registry.get.return_value = sample_server_record(status="running")
        resp = api_client.post("/api/servers", json={
            "name": "test-server",
            "github_url": "https://github.com/owner/repo",
        })
        assert resp.status_code == 409

    @patch("main.deployer")
    @patch("main.registry")
    def test_duplicate_error_status_allows_redeploy(self, mock_registry, mock_deployer, api_client, sample_server_record):
        mock_registry.exists.return_value = True
        mock_registry.get.return_value = sample_server_record(status="error")
        mock_deployer.deploy.return_value = None
        resp = api_client.post("/api/servers", json={
            "name": "test-server",
            "github_url": "https://github.com/owner/repo",
        })
        assert resp.status_code == 202

    def test_validation_error_returns_422(self, api_client):
        resp = api_client.post("/api/servers", json={
            "name": "INVALID NAME!",
            "github_url": "https://github.com/owner/repo",
        })
        assert resp.status_code == 422

    def test_missing_github_url_returns_422(self, api_client):
        resp = api_client.post("/api/servers", json={
            "name": "valid-name",
        })
        assert resp.status_code == 422

    @patch("main.deployer")
    @patch("main.registry")
    def test_deploy_thread_runs_to_success(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        event = threading.Event()

        def fake_deploy(req, log_fn):
            log_fn("deploying...")
            event.set()

        mock_deployer.deploy.side_effect = fake_deploy
        resp = api_client.post("/api/servers", json={
            "name": "new-server",
            "github_url": "https://github.com/owner/repo",
        })
        job_id = resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        job_resp = api_client.get(f"/api/jobs/{job_id}")
        assert job_resp.json()["status"] == "success"

    @patch("main.deployer")
    @patch("main.registry")
    def test_deploy_thread_handles_error(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        mock_registry.get.return_value = None
        event = threading.Event()

        def fake_deploy(req, log_fn):
            event.set()
            raise RuntimeError("deploy failed")

        mock_deployer.deploy.side_effect = fake_deploy
        resp = api_client.post("/api/servers", json={
            "name": "new-server",
            "github_url": "https://github.com/owner/repo",
        })
        job_id = resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        job_resp = api_client.get(f"/api/jobs/{job_id}")
        assert job_resp.json()["status"] == "error"

    @patch("main.deployer")
    @patch("main.registry")
    def test_no_name_creates_pending_job(self, mock_registry, mock_deployer, api_client):
        mock_deployer.deploy.return_value = None
        resp = api_client.post("/api/servers", json={
            "github_url": "https://github.com/owner/repo",
        })
        assert resp.status_code == 202
        assert resp.json()["server_name"] == "(pending)"


# ============================================================
# DELETE /api/servers/{name}
# ============================================================

class TestDeleteServer:
    @patch("main.deployer")
    @patch("main.registry")
    def test_returns_202(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = True
        mock_deployer.remove.return_value = None
        resp = api_client.delete("/api/servers/test-server")
        assert resp.status_code == 202
        assert resp.json()["server_name"] == "test-server"

    @patch("main.registry")
    def test_not_found_returns_404(self, mock_registry, api_client):
        mock_registry.exists.return_value = False
        resp = api_client.delete("/api/servers/nonexistent")
        assert resp.status_code == 404

    @patch("main.deployer")
    @patch("main.registry")
    def test_remove_thread_runs_to_success(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = True
        event = threading.Event()

        def fake_remove(name, log_fn):
            log_fn("removing...")
            event.set()

        mock_deployer.remove.side_effect = fake_remove
        resp = api_client.delete("/api/servers/test-server")
        job_id = resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        job_resp = api_client.get(f"/api/jobs/{job_id}")
        assert job_resp.json()["status"] == "success"


# ============================================================
# POST /api/servers/{name}/restart
# ============================================================

class TestRestartServer:
    @patch("main.deployer")
    @patch("main.registry")
    def test_returns_202(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = True
        mock_deployer.restart.return_value = None
        resp = api_client.post("/api/servers/test-server/restart")
        assert resp.status_code == 202
        assert resp.json()["server_name"] == "test-server"

    @patch("main.registry")
    def test_not_found_returns_404(self, mock_registry, api_client):
        mock_registry.exists.return_value = False
        resp = api_client.post("/api/servers/nonexistent/restart")
        assert resp.status_code == 404

    @patch("main.deployer")
    @patch("main.registry")
    def test_restart_thread_runs_to_success(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = True
        event = threading.Event()

        def fake_restart(name, log_fn):
            log_fn("restarting...")
            event.set()

        mock_deployer.restart.side_effect = fake_restart
        resp = api_client.post("/api/servers/test-server/restart")
        job_id = resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        job_resp = api_client.get(f"/api/jobs/{job_id}")
        assert job_resp.json()["status"] == "success"


# ============================================================
# POST /api/servers/{name}/update
# ============================================================

class TestUpdateServer:
    @patch("main.deployer")
    @patch("main.registry")
    def test_returns_202(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = True
        mock_deployer.update.return_value = None
        resp = api_client.post("/api/servers/test-server/update")
        assert resp.status_code == 202
        assert resp.json()["server_name"] == "test-server"

    @patch("main.registry")
    def test_not_found_returns_404(self, mock_registry, api_client):
        mock_registry.exists.return_value = False
        resp = api_client.post("/api/servers/nonexistent/update")
        assert resp.status_code == 404

    @patch("main.deployer")
    @patch("main.registry")
    def test_update_thread_runs_to_success(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = True
        event = threading.Event()

        def fake_update(name, log_fn):
            log_fn("updating...")
            event.set()

        mock_deployer.update.side_effect = fake_update
        resp = api_client.post("/api/servers/test-server/update")
        job_id = resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        job_resp = api_client.get(f"/api/jobs/{job_id}")
        assert job_resp.json()["status"] == "success"


# ============================================================
# POST /api/servers/update-check
# ============================================================

class TestUpdateCheckAll:
    @patch("main.deployer")
    def test_returns_202(self, mock_deployer, api_client):
        mock_deployer.check_and_update_all.return_value = []
        resp = api_client.post("/api/servers/update-check")
        assert resp.status_code == 202
        assert resp.json()["server_name"] == "(update-check)"

    @patch("main.deployer")
    def test_check_thread_runs_to_success(self, mock_deployer, api_client):
        event = threading.Event()

        def fake_check(log_fn):
            log_fn("checking...")
            event.set()
            return ["srv1"]

        mock_deployer.check_and_update_all.side_effect = fake_check
        resp = api_client.post("/api/servers/update-check")
        job_id = resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        job_resp = api_client.get(f"/api/jobs/{job_id}")
        assert job_resp.json()["status"] == "success"


# ============================================================
# GET /api/jobs/{job_id}
# ============================================================

class TestGetJob:
    @patch("main.deployer")
    @patch("main.registry")
    def test_found(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        mock_deployer.deploy.return_value = None
        create_resp = api_client.post("/api/servers", json={
            "name": "job-test",
            "github_url": "https://github.com/owner/repo",
        })
        job_id = create_resp.json()["job_id"]
        resp = api_client.get(f"/api/jobs/{job_id}")
        assert resp.status_code == 200
        assert resp.json()["job_id"] == job_id

    def test_not_found(self, api_client):
        resp = api_client.get("/api/jobs/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


# ============================================================
# GET /api/jobs/{job_id}/logs
# ============================================================

class TestGetJobLogs:
    @patch("main.deployer")
    @patch("main.registry")
    def test_full_logs(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        event = threading.Event()

        def fake_deploy(req, log_fn):
            log_fn("step 1")
            log_fn("step 2")
            log_fn("step 3")
            event.set()

        mock_deployer.deploy.side_effect = fake_deploy
        create_resp = api_client.post("/api/servers", json={
            "name": "log-test",
            "github_url": "https://github.com/owner/repo",
        })
        job_id = create_resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        resp = api_client.get(f"/api/jobs/{job_id}/logs")
        assert resp.status_code == 200
        body = resp.json()
        assert body["job_id"] == job_id
        log_lines = [l for l in body["logs"] if "step" in l]
        assert len(log_lines) == 3
        assert body["total"] >= 3

    @patch("main.deployer")
    @patch("main.registry")
    def test_logs_with_offset(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        event = threading.Event()

        def fake_deploy(req, log_fn):
            log_fn("line-a")
            log_fn("line-b")
            event.set()

        mock_deployer.deploy.side_effect = fake_deploy
        create_resp = api_client.post("/api/servers", json={
            "name": "offset-test",
            "github_url": "https://github.com/owner/repo",
        })
        job_id = create_resp.json()["job_id"]
        event.wait(timeout=2)
        time.sleep(0.2)

        resp_full = api_client.get(f"/api/jobs/{job_id}/logs?offset=0")
        total = resp_full.json()["total"]

        resp_offset = api_client.get(f"/api/jobs/{job_id}/logs?offset={total - 1}")
        assert resp_offset.status_code == 200
        assert len(resp_offset.json()["logs"]) == 1

    @patch("main.deployer")
    @patch("main.registry")
    def test_offset_beyond_total_returns_empty(self, mock_registry, mock_deployer, api_client):
        mock_registry.exists.return_value = False
        mock_deployer.deploy.return_value = None
        create_resp = api_client.post("/api/servers", json={
            "name": "empty-test",
            "github_url": "https://github.com/owner/repo",
        })
        job_id = create_resp.json()["job_id"]
        time.sleep(0.3)

        resp = api_client.get(f"/api/jobs/{job_id}/logs?offset=9999")
        assert resp.status_code == 200
        assert resp.json()["logs"] == []

    def test_logs_not_found(self, api_client):
        resp = api_client.get("/api/jobs/00000000-0000-0000-0000-000000000000/logs")
        assert resp.status_code == 404


# ============================================================
# _cleanup_old_jobs
# ============================================================

class TestCleanupOldJobs:
    def test_removes_expired_jobs(self, api_client, monkeypatch):
        import main
        from models import DeployJob

        expired_time = (
            (datetime.now(UTC) - timedelta(seconds=7200))
            .isoformat()
            .replace("+00:00", "Z")
        )
        old_job = DeployJob(
            job_id="old-job",
            server_name="old-server",
            status="success",
            finished_at=expired_time,
        )
        with main._jobs_lock:
            main._jobs["old-job"] = old_job

        main._cleanup_old_jobs()

        with main._jobs_lock:
            assert "old-job" not in main._jobs

    def test_keeps_recent_jobs(self, api_client, monkeypatch):
        import main
        from models import DeployJob

        recent_time = (
            datetime.now(UTC).isoformat().replace("+00:00", "Z")
        )
        recent_job = DeployJob(
            job_id="recent-job",
            server_name="recent-server",
            status="success",
            finished_at=recent_time,
        )
        with main._jobs_lock:
            main._jobs["recent-job"] = recent_job

        main._cleanup_old_jobs()

        with main._jobs_lock:
            assert "recent-job" in main._jobs

    def test_keeps_running_jobs(self, api_client, monkeypatch):
        import main
        from models import DeployJob

        running_job = DeployJob(
            job_id="running-job",
            server_name="running-server",
            status="running",
        )
        with main._jobs_lock:
            main._jobs["running-job"] = running_job

        main._cleanup_old_jobs()

        with main._jobs_lock:
            assert "running-job" in main._jobs
