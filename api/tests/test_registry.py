import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import registry
from models import ServerRecord


class TestLoad:
    def test_returns_empty_dict_when_file_missing(self, tmp_registry_file):
        assert registry.load() == {}

    def test_returns_saved_data(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        data = {rec.name: rec.model_dump()}
        tmp_registry_file.write_text(json.dumps(data), encoding="utf-8")
        result = registry.load()
        assert result == data


class TestSave:
    def test_creates_parent_dirs(self, tmp_path, monkeypatch):
        nested = tmp_path / "a" / "b" / "servers.json"
        monkeypatch.setattr(registry, "REGISTRY_PATH", nested)
        registry.save({"k": "v"})
        assert nested.exists()
        assert json.loads(nested.read_text("utf-8")) == {"k": "v"}

    def test_writes_valid_json(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        data = {rec.name: rec.model_dump()}
        registry.save(data)
        loaded = json.loads(tmp_registry_file.read_text("utf-8"))
        assert loaded == data

    def test_uses_flock(self, tmp_registry_file):
        with patch("registry.fcntl") as mock_fcntl:
            registry.save({"a": 1})
            assert mock_fcntl.flock.call_count == 2
            mock_fcntl.flock.assert_any_call(
                pytest.approx(mock_fcntl.flock.call_args_list[0][0][0], rel=None),
                mock_fcntl.LOCK_EX,
            )


class TestGetAll:
    def test_empty_registry(self, tmp_registry_file):
        assert registry.get_all() == []

    def test_with_records(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.save({rec.name: rec.model_dump()})
        result = registry.get_all()
        assert len(result) == 1
        assert isinstance(result[0], ServerRecord)
        assert result[0].name == "test-server"


class TestGet:
    def test_existing_returns_record(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.save({rec.name: rec.model_dump()})
        result = registry.get("test-server")
        assert isinstance(result, ServerRecord)
        assert result.name == "test-server"

    def test_nonexistent_returns_none(self, tmp_registry_file):
        assert registry.get("no-such") is None


class TestUpsert:
    def test_creates_new(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.upsert(rec)
        data = registry.load()
        assert "test-server" in data

    def test_updates_existing(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.upsert(rec)
        updated = sample_server_record(description="updated desc")
        registry.upsert(updated)
        data = registry.load()
        assert data["test-server"]["description"] == "updated desc"

    def test_sets_updated_at(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.upsert(rec)
        data = registry.load()
        assert data["test-server"]["updated_at"].endswith("Z")


class TestDelete:
    def test_existing_returns_true(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.save({rec.name: rec.model_dump()})
        assert registry.delete("test-server") is True
        assert registry.load() == {}

    def test_nonexistent_returns_false(self, tmp_registry_file):
        assert registry.delete("ghost") is False


class TestExists:
    def test_true(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record()
        registry.save({rec.name: rec.model_dump()})
        assert registry.exists("test-server") is True

    def test_false(self, tmp_registry_file):
        assert registry.exists("nope") is False


class TestNextPort:
    def test_default_group_starts_at_8001(self, tmp_registry_file):
        with patch.object(registry, "_docker_used_ports", return_value=set()):
            assert registry.next_port("default") == 8001

    def test_user_group_starts_at_8100(self, tmp_registry_file):
        with patch.object(registry, "_docker_used_ports", return_value=set()):
            assert registry.next_port("user") == 8100

    def test_skips_used_ports_from_registry(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record(port=8100, static_ip="172.20.0.101")
        registry.save({rec.name: rec.model_dump()})
        with patch.object(registry, "_docker_used_ports", return_value=set()):
            assert registry.next_port("user") == 8101

    def test_skips_used_ports_from_docker(self, tmp_registry_file):
        with patch.object(registry, "_docker_used_ports", return_value={8100, 8101}):
            assert registry.next_port("user") == 8102

    def test_raises_when_exhausted(self, tmp_registry_file):
        all_ports = set(range(8100, 8200))
        with patch.object(registry, "_docker_used_ports", return_value=all_ports):
            with pytest.raises(RuntimeError):
                registry.next_port("user")


class TestNextStaticIp:
    def test_default_group_starts_at_11(self, tmp_registry_file):
        with patch.object(registry, "_docker_used_ips", return_value=set()):
            assert registry.next_static_ip("default") == "172.20.0.11"

    def test_user_group_starts_at_101(self, tmp_registry_file):
        with patch.object(registry, "_docker_used_ips", return_value=set()):
            assert registry.next_static_ip("user") == "172.20.0.101"

    def test_skips_used_ips(self, tmp_registry_file, sample_server_record):
        rec = sample_server_record(static_ip="172.20.0.101", port=8100)
        registry.save({rec.name: rec.model_dump()})
        with patch.object(registry, "_docker_used_ips", return_value=set()):
            assert registry.next_static_ip("user") == "172.20.0.102"

    def test_raises_when_exhausted(self, tmp_registry_file):
        all_ips = {f"172.20.0.{i}" for i in range(101, 200)}
        with patch.object(registry, "_docker_used_ips", return_value=all_ips):
            with pytest.raises(RuntimeError):
                registry.next_static_ip("user")


class TestDockerUsedPorts:
    def test_parses_docker_ps_output(self):
        mock_result = MagicMock(stdout="0.0.0.0:8001->8000/tcp\n127.0.0.1:8100->3000/tcp\n")
        with patch("registry.subprocess.run", return_value=mock_result):
            ports = registry._docker_used_ports()
        assert ports == {8001, 8100}

    def test_returns_empty_on_exception(self):
        with patch("registry.subprocess.run", side_effect=Exception("docker not found")):
            assert registry._docker_used_ports() == set()


class TestDockerUsedIps:
    def test_parses_network_inspect_output(self):
        mock_result = MagicMock(stdout="172.20.0.11/24 172.20.0.101/24 ")
        with patch("registry.subprocess.run", return_value=mock_result):
            ips = registry._docker_used_ips()
        assert ips == {"172.20.0.11", "172.20.0.101"}

    def test_returns_empty_on_exception(self):
        with patch("registry.subprocess.run", side_effect=Exception("docker not found")):
            assert registry._docker_used_ips() == set()
