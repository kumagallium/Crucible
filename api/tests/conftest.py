"""
共通テスト fixture
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# テスト対象モジュールが api/ 直下にあるため、パスを追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def tmp_registry_file(tmp_path, monkeypatch):
    """一時ファイルでレジストリを差し替える。"""
    import registry

    reg_file = tmp_path / "servers.json"
    monkeypatch.setattr(registry, "REGISTRY_PATH", reg_file)
    return reg_file


@pytest.fixture()
def sample_register_request():
    """最小限の有効な RegisterRequest を返す。"""
    from models import RegisterRequest

    return RegisterRequest(
        name="test-server",
        display_name="Test Server",
        description="A test MCP server",
        github_url="https://github.com/owner/repo",
        branch="main",
        group="user",
    )


@pytest.fixture()
def sample_server_record():
    """テスト用の ServerRecord を返すファクトリ。"""
    from models import ServerRecord

    def _make(**overrides):
        defaults = dict(
            name="test-server",
            display_name="Test Server",
            description="A test MCP server",
            icon="🔧",
            github_url="https://github.com/owner/repo",
            branch="main",
            group="user",
            port=8100,
            static_ip="172.20.0.101",
            status="running",
        )
        defaults.update(overrides)
        return ServerRecord(**defaults)

    return _make


@pytest.fixture()
def mock_subprocess_run():
    """subprocess.run を全面モックする。"""
    with patch("subprocess.run") as m:
        m.return_value = MagicMock(
            returncode=0, stdout="", stderr=""
        )
        yield m


@pytest.fixture()
def clean_jobs_store():
    """テスト間でジョブストアをクリアする。"""
    import main

    main._jobs.clear()
    yield
    main._jobs.clear()


@pytest.fixture()
def api_client(monkeypatch, clean_jobs_store):
    """認証なしの FastAPI TestClient。"""
    import main

    monkeypatch.setattr(main, "_REGISTRY_API_KEY", "")
    from fastapi.testclient import TestClient

    return TestClient(main.app)


@pytest.fixture()
def api_client_with_auth(monkeypatch, clean_jobs_store):
    """認証ありの FastAPI TestClient。"""
    import main

    monkeypatch.setattr(main, "_REGISTRY_API_KEY", "test-secret-key")
    from fastapi.testclient import TestClient

    return TestClient(main.app)
