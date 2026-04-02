from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch, PropertyMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import deployer
from models import RegisterRequest, ServerRecord


def _log(msg: str) -> None:
    pass


def _make_request(**overrides) -> RegisterRequest:
    defaults = dict(
        name="test-server",
        display_name="Test Server",
        description="A test MCP server",
        github_url="https://github.com/owner/repo",
        branch="main",
        group="user",
    )
    defaults.update(overrides)
    return RegisterRequest(**defaults)


# ---------------------------------------------------------------------------
# _run
# ---------------------------------------------------------------------------

class TestRun:
    @patch("subprocess.run")
    def test_success_logs_output(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="line1\nline2", stderr="")
        logs = []
        deployer._run(["echo", "hi"], logs.append)
        assert "line1" in logs
        assert "line2" in logs

    @patch("subprocess.run")
    def test_failure_raises(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="bad")
        with pytest.raises(RuntimeError, match="コマンド失敗"):
            deployer._run(["false"], _log)

    @patch("subprocess.run")
    def test_token_masking(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        logs = []
        deployer._run(
            ["git", "clone", "https://tok123@github.com/owner/repo"],
            logs.append,
        )
        assert any("<token>@github.com" in l for l in logs)
        assert not any("tok123" in l for l in logs)


# ---------------------------------------------------------------------------
# _run_stream
# ---------------------------------------------------------------------------

class TestRunStream:
    @patch("subprocess.Popen")
    def test_success_reads_lines(self, mock_popen):
        proc = MagicMock()
        proc.stdout = iter(["line1\n", "line2\n"])
        proc.returncode = 0
        mock_popen.return_value = proc
        logs = []
        deployer._run_stream(["cmd"], logs.append)
        assert "line1" in logs
        assert "line2" in logs

    @patch("subprocess.Popen")
    def test_failure_raises(self, mock_popen):
        proc = MagicMock()
        proc.stdout = iter([])
        proc.returncode = 1
        mock_popen.return_value = proc
        with pytest.raises(RuntimeError, match="コマンド失敗"):
            deployer._run_stream(["cmd"], _log)


# ---------------------------------------------------------------------------
# _resolve_request_from_mcp_json
# ---------------------------------------------------------------------------

class TestResolveRequestFromMcpJson:
    def test_fills_missing_name(self, tmp_path):
        mcp = tmp_path / "mcp.json"
        mcp.write_text(json.dumps({"name": "from-json"}))
        req = _make_request(name=None)
        deployer._resolve_request_from_mcp_json(req, mcp, _log)
        assert req.name == "from-json"

    def test_fills_missing_display_name(self, tmp_path):
        mcp = tmp_path / "mcp.json"
        mcp.write_text(json.dumps({"display_name": "Nice Name"}))
        req = _make_request(display_name=None)
        deployer._resolve_request_from_mcp_json(req, mcp, _log)
        assert req.display_name == "Nice Name"

    def test_fills_missing_description(self, tmp_path):
        mcp = tmp_path / "mcp.json"
        mcp.write_text(json.dumps({"description": "From json desc"}))
        req = _make_request(description="")
        deployer._resolve_request_from_mcp_json(req, mcp, _log)
        assert req.description == "From json desc"

    def test_does_not_overwrite_existing(self, tmp_path):
        mcp = tmp_path / "mcp.json"
        mcp.write_text(json.dumps({"name": "overwrite", "display_name": "X", "description": "Y"}))
        req = _make_request(name="test-server", display_name="Original", description="Orig desc")
        deployer._resolve_request_from_mcp_json(req, mcp, _log)
        assert req.name == "test-server"
        assert req.display_name == "Original"
        assert req.description == "Orig desc"

    def test_malformed_json(self, tmp_path):
        mcp = tmp_path / "mcp.json"
        mcp.write_text("{broken json")
        req = _make_request()
        deployer._resolve_request_from_mcp_json(req, mcp, _log)
        assert req.name == "test-server"


# ---------------------------------------------------------------------------
# _generate_mcp_json
# ---------------------------------------------------------------------------

class TestGenerateMcpJson:
    def test_creates_valid_json(self, tmp_path):
        req = _make_request(env_vars={"KEY": "val"})
        deployer._generate_mcp_json(req, 8100, "172.20.0.10", tmp_path)
        result = json.loads((tmp_path / "mcp.json").read_text())
        assert result["name"] == "test-server"
        assert result["port"] == 8100
        assert result["static_ip"] == "172.20.0.10"
        assert result["display_name"] == "Test Server"
        assert "KEY" in result["env"]["optional"]
        assert result["groups"] == ["user"]


# ---------------------------------------------------------------------------
# _clone_repo
# ---------------------------------------------------------------------------

class TestCloneRepo:
    @patch("deployer.decrypt_token", return_value="")
    @patch("deployer._run")
    def test_public_repo_no_token(self, mock_run, mock_decrypt):
        req = _make_request(github_token="")
        with patch.object(deployer, "GITHUB_TOKEN", ""):
            deployer._clone_repo(req, Path("/tmp/dest"), _log)
        cmd = mock_run.call_args[0][0]
        assert "https://github.com/owner/repo" in cmd

    @patch("deployer.decrypt_token", return_value="")
    @patch("deployer._run")
    def test_with_request_token(self, mock_run, mock_decrypt):
        req = _make_request(github_token="ghp_abc")
        with patch.object(deployer, "GITHUB_TOKEN", ""):
            deployer._clone_repo(req, Path("/tmp/dest"), _log)
        cmd = mock_run.call_args[0][0]
        assert "https://ghp_abc@github.com/owner/repo" in cmd

    @patch("deployer.decrypt_token", return_value="ghp_stored")
    @patch("deployer._run")
    def test_with_stored_encrypted_token(self, mock_run, mock_decrypt):
        req = _make_request(github_token="")
        with patch.object(deployer, "GITHUB_TOKEN", ""):
            deployer._clone_repo(req, Path("/tmp/dest"), _log, stored_token_enc="enc123")
        mock_decrypt.assert_called_once_with("enc123")
        cmd = mock_run.call_args[0][0]
        assert "https://ghp_stored@github.com/owner/repo" in cmd

    @patch("deployer.decrypt_token", return_value="")
    @patch("deployer._run")
    def test_git_terminal_prompt_disabled(self, mock_run, mock_decrypt):
        req = _make_request()
        with patch.object(deployer, "GITHUB_TOKEN", ""):
            deployer._clone_repo(req, Path("/tmp/dest"), _log)
        call_kwargs = mock_run.call_args[1]
        assert call_kwargs.get("env", {}).get("GIT_TERMINAL_PROMPT") == "0"


# ---------------------------------------------------------------------------
# _detect_transport
# ---------------------------------------------------------------------------

class TestDetectTransport:
    def test_auto_with_expose(self, tmp_path):
        (tmp_path / "Dockerfile").write_text("FROM python\nEXPOSE 8000\nCMD ['run']")
        assert deployer._detect_transport(tmp_path, "auto") == "sse"

    def test_auto_without_expose(self, tmp_path):
        (tmp_path / "Dockerfile").write_text("FROM python\nCMD ['run']")
        assert deployer._detect_transport(tmp_path, "auto") == "stdio"

    def test_auto_no_dockerfile(self, tmp_path):
        assert deployer._detect_transport(tmp_path, "auto") == "stdio"

    def test_explicit_sse(self, tmp_path):
        assert deployer._detect_transport(tmp_path, "sse") == "sse"

    def test_explicit_stdio(self, tmp_path):
        assert deployer._detect_transport(tmp_path, "stdio") == "stdio"


# ---------------------------------------------------------------------------
# _patch_fastmcp_enabled
# ---------------------------------------------------------------------------

class TestPatchFastmcpEnabled:
    def test_removes_enabled(self, tmp_path):
        src = tmp_path / "server.py"
        src.write_text('@mcp.tool(enabled=True, name="foo")\ndef x(): pass')
        deployer._patch_fastmcp_enabled(tmp_path, _log)
        result = src.read_text()
        assert "enabled" not in result

    def test_leaves_clean_code(self, tmp_path):
        src = tmp_path / "server.py"
        original = '@mcp.tool(name="foo")\ndef x(): pass'
        src.write_text(original)
        deployer._patch_fastmcp_enabled(tmp_path, _log)
        assert src.read_text() == original


# ---------------------------------------------------------------------------
# _strip_mount_options
# ---------------------------------------------------------------------------

class TestStripMountOptions:
    def test_removes_mount(self, tmp_path):
        df = tmp_path / "Dockerfile"
        df.write_text("RUN --mount=type=cache,target=/root/.cache pip install -r req.txt")
        deployer._strip_mount_options(df, _log)
        assert "--mount" not in df.read_text()
        assert "pip install" in df.read_text()

    def test_noop_when_no_mount(self, tmp_path):
        df = tmp_path / "Dockerfile"
        original = "RUN pip install -r req.txt"
        df.write_text(original)
        deployer._strip_mount_options(df, _log)
        assert df.read_text() == original


# ---------------------------------------------------------------------------
# _build_image
# ---------------------------------------------------------------------------

class TestGenerateDockerfile:
    """Dockerfile がないリポジトリに対する自動生成テスト。"""

    def test_uv_based(self, tmp_path):
        """pyproject.toml + uv.lock → uv ベースの Dockerfile を生成する。"""
        (tmp_path / "pyproject.toml").write_text(
            '[project]\nname = "test"\n[project.scripts]\nmy-tool = "pkg:main"\n'
        )
        (tmp_path / "uv.lock").write_text("")
        deployer._generate_dockerfile(tmp_path, _log)
        content = (tmp_path / "Dockerfile").read_text()
        assert "uv sync" in content
        assert '"uv", "run", "my-tool"' in content

    def test_pip_based(self, tmp_path):
        """pyproject.toml のみ → pip install . ベースの Dockerfile を生成する。"""
        (tmp_path / "pyproject.toml").write_text(
            '[project]\nname = "test"\n[project.scripts]\nmy-cmd = "pkg:main"\n'
        )
        deployer._generate_dockerfile(tmp_path, _log)
        content = (tmp_path / "Dockerfile").read_text()
        assert "pip install" in content
        assert '"my-cmd"' in content

    def test_requirements_txt(self, tmp_path):
        """requirements.txt のみ → pip install -r ベースの Dockerfile を生成する。"""
        (tmp_path / "requirements.txt").write_text("mcp>=1.0\n")
        deployer._generate_dockerfile(tmp_path, _log)
        content = (tmp_path / "Dockerfile").read_text()
        assert "-r requirements.txt" in content

    def test_nodejs(self, tmp_path):
        """package.json → Node.js ベースの Dockerfile を生成する。"""
        (tmp_path / "package.json").write_text('{"name": "test"}')
        deployer._generate_dockerfile(tmp_path, _log)
        content = (tmp_path / "Dockerfile").read_text()
        assert "node:" in content
        assert "npm install" in content

    def test_no_project_files_raises(self, tmp_path):
        """プロジェクトファイルがない場合はエラーになる。"""
        with pytest.raises(RuntimeError, match="自動生成もできません"):
            deployer._generate_dockerfile(tmp_path, _log)

    def test_entrypoint_detection(self, tmp_path):
        """pyproject.toml の [project.scripts] からエントリポイントを検出する。"""
        (tmp_path / "pyproject.toml").write_text(
            '[project]\nname = "arxiv-latex-mcp"\n\n'
            '[project.scripts]\narxiv-latex-mcp = "arxiv_latex_mcp.__main__:main"\n'
        )
        result = deployer._detect_python_entrypoint(tmp_path)
        assert result == "arxiv-latex-mcp"


class TestBuildImage:
    @patch("deployer._strip_mount_options")
    @patch("deployer._patch_fastmcp_enabled")
    @patch("deployer._run_stream")
    def test_default_context(self, mock_stream, mock_patch, mock_strip, tmp_path):
        (tmp_path / "Dockerfile").write_text("FROM python:3.12-slim\n")
        deployer._build_image("myimg", tmp_path, _log)
        cmd = mock_stream.call_args[0][0]
        assert cmd == ["docker", "build", "-t", "myimg:latest", "."]
        assert mock_stream.call_args[1].get("cwd") == str(tmp_path)

    @patch("deployer._strip_mount_options")
    @patch("deployer._patch_fastmcp_enabled")
    @patch("deployer._run_stream")
    def test_with_subdir_context(self, mock_stream, mock_patch, mock_strip, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "Dockerfile").write_text("FROM python:3.12-slim\n")
        deployer._build_image("myimg", sub, _log, context_dir=tmp_path)
        cmd = mock_stream.call_args[0][0]
        assert "-f" in cmd
        assert str(sub / "Dockerfile") in cmd

    @patch("deployer._strip_mount_options")
    @patch("deployer._patch_fastmcp_enabled")
    @patch("deployer._run_stream")
    def test_auto_generates_dockerfile(self, mock_stream, mock_patch, mock_strip, tmp_path):
        """Dockerfile がない場合に自動生成してからビルドする。"""
        (tmp_path / "pyproject.toml").write_text(
            '[project]\nname = "test"\n[project.scripts]\nmy-srv = "pkg:main"\n'
        )
        (tmp_path / "uv.lock").write_text("")
        deployer._build_image("myimg", tmp_path, _log)
        assert (tmp_path / "Dockerfile").exists()
        cmd = mock_stream.call_args[0][0]
        assert cmd == ["docker", "build", "-t", "myimg:latest", "."]


# ---------------------------------------------------------------------------
# _start_container
# ---------------------------------------------------------------------------

class TestStartContainer:
    @patch("deployer._run")
    @patch("subprocess.run")
    def test_removes_existing_container(self, mock_subproc, mock_run):
        mock_subproc.return_value = MagicMock(returncode=0, stdout="test-server\nother", stderr="")
        deployer._start_container("test-server", 8100, "172.20.0.10", {}, _log)
        stop_calls = [c for c in mock_subproc.call_args_list if "stop" in str(c)]
        assert len(stop_calls) > 0

    @patch("deployer._run")
    @patch("subprocess.run")
    def test_with_mcp_net(self, mock_subproc, mock_run):
        def side_effect(cmd, **kw):
            if "network" in cmd and "inspect" in cmd:
                return MagicMock(returncode=0)
            return MagicMock(returncode=0, stdout="", stderr="")
        mock_subproc.side_effect = side_effect
        deployer._start_container("test-server", 8100, "172.20.0.10", {}, _log)
        run_cmd = mock_run.call_args[0][0]
        assert "--network" in run_cmd
        assert "mcp-net" in run_cmd

    @patch("deployer._run")
    @patch("subprocess.run")
    def test_without_mcp_net(self, mock_subproc, mock_run):
        def side_effect(cmd, **kw):
            if "network" in cmd and "inspect" in cmd:
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        mock_subproc.side_effect = side_effect
        deployer._start_container("test-server", 8100, "172.20.0.10", {}, _log)
        connect_calls = [c for c in mock_subproc.call_args_list if "connect" in str(c)]
        assert len(connect_calls) > 0

    @patch("deployer._run")
    @patch("subprocess.run")
    def test_passes_env_vars(self, mock_subproc, mock_run):
        mock_subproc.return_value = MagicMock(returncode=0, stdout="", stderr="")
        deployer._start_container("srv", 8100, "172.20.0.10", {"FOO": "bar"}, _log)
        run_cmd = mock_run.call_args[0][0]
        idx = run_cmd.index("-e")
        assert run_cmd[idx + 1] == "FOO=bar"


# ---------------------------------------------------------------------------
# _health_check
# ---------------------------------------------------------------------------

class TestHealthCheck:
    @patch("time.sleep")
    @patch("subprocess.run")
    def test_success_on_first_try(self, mock_subproc, mock_sleep):
        mock_subproc.return_value = MagicMock(returncode=0, stdout="true", stderr="")

        mock_requests = MagicMock()
        mock_requests.get.return_value = MagicMock(status_code=200)
        mock_requests.exceptions.Timeout = Exception
        mock_requests.exceptions.ConnectionError = ConnectionError
        with patch.dict("sys.modules", {"requests": mock_requests}):
            deployer._health_check("srv", 8100, _log)
        mock_sleep.assert_not_called()

    @patch("time.sleep")
    @patch("subprocess.run")
    def test_timeout_counts_as_success(self, mock_subproc, mock_sleep):
        mock_subproc.return_value = MagicMock(returncode=0, stdout="true", stderr="")

        class FakeTimeout(Exception):
            pass

        class FakeConnError(Exception):
            pass

        mock_requests = MagicMock()
        mock_requests.exceptions.Timeout = FakeTimeout
        mock_requests.exceptions.ConnectionError = FakeConnError
        mock_requests.get.side_effect = FakeTimeout("timeout")
        with patch.dict("sys.modules", {"requests": mock_requests}):
            deployer._health_check("srv", 8100, _log)
        mock_sleep.assert_not_called()

    @patch("time.sleep")
    @patch("subprocess.run")
    def test_retries_then_succeeds(self, mock_subproc, mock_sleep):
        mock_subproc.return_value = MagicMock(returncode=0, stdout="true", stderr="")

        class FakeTimeout(Exception):
            pass

        class FakeConnError(Exception):
            pass

        mock_requests = MagicMock()
        mock_requests.exceptions.Timeout = FakeTimeout
        mock_requests.exceptions.ConnectionError = FakeConnError

        call_count = [0]
        def get_side_effect(url, **kw):
            call_count[0] += 1
            if call_count[0] <= 4:
                raise FakeConnError("no conn")
            return MagicMock(status_code=200)

        mock_requests.get.side_effect = get_side_effect
        with patch.dict("sys.modules", {"requests": mock_requests}):
            deployer._health_check("srv", 8100, _log)

    @patch("time.sleep")
    @patch("subprocess.run")
    def test_all_retries_fail(self, mock_subproc, mock_sleep):
        mock_subproc.return_value = MagicMock(returncode=0, stdout="true", stderr="")

        class FakeTimeout(Exception):
            pass

        class FakeConnError(Exception):
            pass

        mock_requests = MagicMock()
        mock_requests.exceptions.Timeout = FakeTimeout
        mock_requests.exceptions.ConnectionError = FakeConnError
        mock_requests.get.side_effect = FakeConnError("no conn")

        with patch.dict("sys.modules", {"requests": mock_requests}):
            with pytest.raises(RuntimeError, match="ヘルスチェック"):
                deployer._health_check("srv", 8100, _log)


# ---------------------------------------------------------------------------
# _register_dify
# ---------------------------------------------------------------------------

class TestRegisterDify:
    def test_skips_when_no_credentials(self):
        with patch.object(deployer, "DIFY_EMAIL", ""), patch.object(deployer, "DIFY_PASSWORD", ""):
            result = deployer._register_dify("srv", "1.2.3.4", 8100, "🔧", "Srv", _log)
            assert result == (False, "/sse")

    def test_login_failure(self):
        with patch.object(deployer, "DIFY_EMAIL", "a@b.c"), patch.object(deployer, "DIFY_PASSWORD", "pw"):
            mock_requests = MagicMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"result": "fail"}
            mock_requests.post.return_value = mock_resp
            with patch.dict("sys.modules", {"requests": mock_requests}):
                result = deployer._register_dify("srv", "1.2.3.4", 8100, "🔧", "Srv", _log)
                assert result == (False, "/sse")

    def test_success_with_mcp_transport(self):
        with patch.object(deployer, "DIFY_EMAIL", "a@b.c"), patch.object(deployer, "DIFY_PASSWORD", "pw"):
            mock_requests = MagicMock()
            login_resp = MagicMock()
            login_resp.json.return_value = {"result": "success"}
            login_resp.cookies.get = lambda k, d="": "tok123" if k == "access_token" else "csrf456"
            mock_requests.post.return_value = login_resp

            mcp_probe = MagicMock(status_code=200)
            mock_requests.get.return_value = mcp_probe
            mock_requests.exceptions.Timeout = Exception
            mock_requests.exceptions.ConnectionError = ConnectionError

            mock_conn = MagicMock()
            mock_http_resp = MagicMock()
            mock_http_resp.status = 200
            mock_http_resp.read.return_value = b'{"result": "success"}'
            mock_conn.getresponse.return_value = mock_http_resp

            with patch.dict("sys.modules", {"requests": mock_requests}):
                with patch("http.client.HTTPConnection", return_value=mock_conn):
                    result = deployer._register_dify("srv", "1.2.3.4", 8100, "🔧", "Srv", _log)
                    assert result == (True, "/mcp")

    def test_success_with_sse_fallback(self):
        with patch.object(deployer, "DIFY_EMAIL", "a@b.c"), patch.object(deployer, "DIFY_PASSWORD", "pw"):
            mock_requests = MagicMock()
            login_resp = MagicMock()
            login_resp.json.return_value = {"result": "success"}
            login_resp.cookies.get = lambda k, d="": "tok123" if k == "access_token" else "csrf456"
            mock_requests.post.return_value = login_resp

            mock_requests.get.side_effect = Exception("conn error")

            mock_conn = MagicMock()
            mock_http_resp = MagicMock()
            mock_http_resp.status = 200
            mock_http_resp.read.return_value = b'{"result": "success"}'
            mock_conn.getresponse.return_value = mock_http_resp

            with patch.dict("sys.modules", {"requests": mock_requests}):
                with patch("http.client.HTTPConnection", return_value=mock_conn):
                    result = deployer._register_dify("srv", "1.2.3.4", 8100, "🔧", "Srv", _log)
                    assert result == (True, "/sse")


# ---------------------------------------------------------------------------
# _unregister_dify
# ---------------------------------------------------------------------------

class TestUnregisterDify:
    @patch("subprocess.run")
    def test_success(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="DELETE 1", stderr="")
        logs = []
        deployer._unregister_dify("srv", logs.append)
        assert any("完了" in l for l in logs)

    @patch("subprocess.run")
    def test_failure_doesnt_raise(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
        deployer._unregister_dify("srv", _log)


# ---------------------------------------------------------------------------
# deploy
# ---------------------------------------------------------------------------

class TestDeploy:
    @patch("deployer.encrypt_token", return_value="enc")
    @patch("deployer.registry")
    @patch("deployer._register_dify", return_value=(True, "/mcp"))
    @patch("deployer._health_check")
    @patch("deployer._start_container")
    @patch("deployer._build_image")
    @patch("deployer._detect_transport", return_value="sse")
    @patch("deployer._clone_repo")
    @patch("tempfile.mkdtemp")
    @patch("shutil.rmtree")
    def test_full_success(self, mock_rmtree, mock_mkdtemp, mock_clone,
                          mock_detect, mock_build, mock_start,
                          mock_health, mock_dify, mock_reg, mock_encrypt,
                          tmp_path):
        mock_mkdtemp.return_value = str(tmp_path)
        mock_reg.next_port.return_value = 8200
        mock_reg.next_static_ip.return_value = "172.20.0.50"
        mock_reg.get.return_value = None

        repo_dir = tmp_path / "test-server"
        repo_dir.mkdir()
        mcp_json = repo_dir / "mcp.json"
        mcp_json.write_text(json.dumps({"name": "test-server", "display_name": "Test"}))

        def fake_clone(req, dest, log, stored_token_enc=""):
            dest.mkdir(exist_ok=True)
            (dest / "mcp.json").write_text(json.dumps({"name": "test-server", "display_name": "Test"}))

        mock_clone.side_effect = fake_clone
        req = _make_request(github_token="ghp_tok")
        record = deployer.deploy(req, _log)
        assert record.status == "running"
        assert record.port == 8200
        mock_reg.upsert.assert_called()

    @patch("deployer.registry")
    @patch("deployer._clone_repo")
    @patch("tempfile.mkdtemp")
    @patch("shutil.rmtree")
    def test_no_mcp_json_and_no_name_raises(self, mock_rmtree, mock_mkdtemp,
                                             mock_clone, mock_reg, tmp_path):
        mock_mkdtemp.return_value = str(tmp_path)
        mock_reg.next_port.return_value = 8200
        mock_reg.next_static_ip.return_value = "172.20.0.50"
        mock_reg.get.return_value = None

        def fake_clone(req, dest, log, stored_token_enc=""):
            dest.mkdir(exist_ok=True)

        mock_clone.side_effect = fake_clone
        req = _make_request(name=None)
        with pytest.raises(RuntimeError, match="mcp.json"):
            deployer.deploy(req, _log)

    @patch("deployer.registry")
    @patch("deployer._clone_repo")
    @patch("tempfile.mkdtemp")
    @patch("shutil.rmtree")
    def test_duplicate_active_name_raises(self, mock_rmtree, mock_mkdtemp,
                                           mock_clone, mock_reg, tmp_path):
        mock_mkdtemp.return_value = str(tmp_path)
        mock_reg.next_port.return_value = 8200
        mock_reg.next_static_ip.return_value = "172.20.0.50"
        existing = MagicMock(status="running", github_token_enc="")
        mock_reg.get.return_value = existing

        def fake_clone(req, dest, log, stored_token_enc=""):
            dest.mkdir(exist_ok=True)
            (dest / "mcp.json").write_text(json.dumps({"name": "test-server"}))

        mock_clone.side_effect = fake_clone
        req = _make_request()
        with pytest.raises(RuntimeError, match="既に登録"):
            deployer.deploy(req, _log)


# ---------------------------------------------------------------------------
# remove
# ---------------------------------------------------------------------------

class TestRemove:
    @patch("deployer.registry")
    @patch("deployer._unregister_dify")
    @patch("subprocess.run")
    def test_remove_calls_all(self, mock_subproc, mock_unreg, mock_reg):
        mock_subproc.return_value = MagicMock(returncode=0)
        deployer.remove("srv", _log)
        stop_call = [c for c in mock_subproc.call_args_list if "stop" in c[0][0]]
        rm_call = [c for c in mock_subproc.call_args_list if "rm" in c[0][0]]
        assert len(stop_call) == 1
        assert len(rm_call) == 1
        mock_unreg.assert_called_once_with("srv", _log)
        mock_reg.delete.assert_called_once_with("srv")


# ---------------------------------------------------------------------------
# restart
# ---------------------------------------------------------------------------

class TestRestart:
    @patch("deployer._health_check")
    @patch("deployer.registry")
    @patch("deployer._run")
    def test_restart_flow(self, mock_run, mock_reg, mock_health):
        record = MagicMock(port=8100, status="stopped", error_message="old err")
        mock_reg.get.return_value = record
        deployer.restart("srv", _log)
        mock_run.assert_called_once()
        assert "restart" in mock_run.call_args[0][0]
        mock_health.assert_called_once_with("srv", 8100, _log)
        assert record.status == "running"
        assert record.error_message is None
        mock_reg.upsert.assert_called_once_with(record)


# ---------------------------------------------------------------------------
# refresh_statuses
# ---------------------------------------------------------------------------

class TestRefreshStatuses:
    @patch("deployer.registry")
    @patch("subprocess.run")
    def test_marks_running(self, mock_run, mock_reg):
        mock_run.return_value = MagicMock(returncode=0, stdout="srv1\nsrv2")
        rec = MagicMock(status="stopped")
        rec.name = "srv1"
        mock_reg.get_all.return_value = [rec]
        deployer.refresh_statuses()
        assert rec.status == "running"
        mock_reg.upsert.assert_called_once_with(rec)

    @patch("deployer.registry")
    @patch("subprocess.run")
    def test_marks_stopped(self, mock_run, mock_reg):
        mock_run.return_value = MagicMock(returncode=0, stdout="other")
        rec = MagicMock(status="running")
        rec.name = "srv1"
        mock_reg.get_all.return_value = [rec]
        deployer.refresh_statuses()
        assert rec.status == "stopped"
        mock_reg.upsert.assert_called_once_with(rec)

    @patch("deployer.registry")
    @patch("subprocess.run", side_effect=FileNotFoundError)
    def test_skips_when_docker_not_found(self, mock_run, mock_reg):
        deployer.refresh_statuses()
        mock_reg.get_all.assert_not_called()


# ---------------------------------------------------------------------------
# _get_local_head
# ---------------------------------------------------------------------------

class TestGetLocalHead:
    @patch("subprocess.run")
    def test_returns_hash(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="abc123def\n")
        result = deployer._get_local_head(Path("/tmp/repo"))
        assert result == "abc123def"

    @patch("subprocess.run")
    def test_returns_empty_on_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        result = deployer._get_local_head(Path("/tmp/repo"))
        assert result == ""


# ---------------------------------------------------------------------------
# _get_remote_head
# ---------------------------------------------------------------------------

class TestGetRemoteHead:
    @patch("subprocess.run")
    def test_returns_hash(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="abc123def456\trefs/heads/main\n",
        )
        result = deployer._get_remote_head("https://github.com/owner/repo", "main")
        assert result == "abc123def456"

    @patch("subprocess.run")
    def test_with_token(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="abc\trefs/heads/main\n")
        deployer._get_remote_head("https://github.com/owner/repo", "main", token="ghp_tok")
        cmd = mock_run.call_args[0][0]
        assert "https://ghp_tok@github.com/owner/repo" in cmd

    @patch("subprocess.run")
    def test_returns_empty_on_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=128, stdout="")
        result = deployer._get_remote_head("https://github.com/owner/repo", "main")
        assert result == ""

    @patch("subprocess.run")
    def test_git_terminal_prompt_disabled(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="abc\trefs/heads/main\n")
        deployer._get_remote_head("https://github.com/owner/repo", "main")
        call_kwargs = mock_run.call_args[1]
        assert call_kwargs.get("env", {}).get("GIT_TERMINAL_PROMPT") == "0"


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

class TestUpdate:
    def _make_record(self, **overrides):
        defaults = dict(
            name="test-server",
            display_name="Test Server",
            description="A test MCP server",
            icon="🔧",
            github_url="https://github.com/owner/repo",
            branch="main",
            subdir="",
            group="user",
            port=8100,
            static_ip="172.20.0.101",
            status="running",
            dify_registered=True,
            endpoint_path="/sse",
            github_token_enc="enc123",
            auto_update=True,
            last_commit_hash="old_hash_123",
        )
        defaults.update(overrides)
        return ServerRecord(**defaults)

    @patch("deployer.decrypt_token", return_value="ghp_tok")
    @patch("deployer._get_remote_head", return_value="old_hash_123")
    @patch("deployer.registry")
    def test_skip_when_no_change(self, mock_reg, mock_remote, mock_decrypt):
        record = self._make_record()
        mock_reg.get.return_value = record
        result = deployer.update("test-server", _log)
        assert result.last_commit_hash == "old_hash_123"

    @patch("deployer.decrypt_token", return_value="ghp_tok")
    @patch("deployer._get_remote_head", return_value="")
    @patch("deployer.registry")
    def test_raises_when_remote_head_unavailable(self, mock_reg, mock_remote, mock_decrypt):
        record = self._make_record()
        mock_reg.get.return_value = record
        with pytest.raises(RuntimeError, match="HEAD を取得できません"):
            deployer.update("test-server", _log)

    @patch("deployer.registry")
    def test_raises_when_server_not_found(self, mock_reg):
        mock_reg.get.return_value = None
        with pytest.raises(RuntimeError, match="サーバーが見つかりません"):
            deployer.update("nonexistent", _log)

    @patch("deployer.decrypt_token", return_value="ghp_tok")
    @patch("deployer._get_remote_head", return_value="new_hash_456")
    @patch("deployer._register_dify", return_value=(True, "/mcp"))
    @patch("deployer._health_check")
    @patch("deployer._start_container")
    @patch("deployer._build_image")
    @patch("deployer._detect_transport", return_value="sse")
    @patch("deployer._clone_repo")
    @patch("deployer._get_local_head", return_value="new_hash_456")
    @patch("subprocess.run")
    @patch("tempfile.mkdtemp")
    @patch("shutil.rmtree")
    @patch("deployer.registry")
    def test_full_update_flow(self, mock_reg, mock_rmtree, mock_mkdtemp,
                               mock_subproc, mock_local_head, mock_clone,
                               mock_detect, mock_build, mock_start,
                               mock_health, mock_dify, mock_remote, mock_decrypt,
                               tmp_path):
        mock_mkdtemp.return_value = str(tmp_path)
        record = self._make_record()
        mock_reg.get.return_value = record
        # docker inspect で環境変数を返す
        mock_subproc.return_value = MagicMock(
            returncode=0, stdout='["FOO=bar","PATH=/usr/bin"]', stderr=""
        )

        result = deployer.update("test-server", _log)
        assert result.last_commit_hash == "new_hash_456"
        assert result.status == "running"
        mock_build.assert_called_once()
        mock_start.assert_called_once()
        mock_health.assert_called_once()
        mock_dify.assert_called_once()
        mock_reg.upsert.assert_called()


# ---------------------------------------------------------------------------
# check_and_update_all
# ---------------------------------------------------------------------------

class TestCheckAndUpdateAll:
    @patch("deployer.registry")
    def test_no_auto_update_servers(self, mock_reg):
        mock_reg.get_all.return_value = []
        result = deployer.check_and_update_all(_log)
        assert result == []

    @patch("deployer.decrypt_token", return_value="")
    @patch("deployer._get_remote_head", return_value="same_hash")
    @patch("deployer.registry")
    def test_no_changes(self, mock_reg, mock_remote, mock_decrypt):
        record = MagicMock(
            name="srv", auto_update=True, status="running",
            github_url="https://github.com/o/r", branch="main",
            last_commit_hash="same_hash", github_token_enc="",
        )
        mock_reg.get_all.return_value = [record]
        with patch.object(deployer, "GITHUB_TOKEN", ""):
            result = deployer.check_and_update_all(_log)
        assert result == []

    @patch("deployer.update")
    @patch("deployer.decrypt_token", return_value="")
    @patch("deployer._get_remote_head", return_value="new_hash")
    @patch("deployer.registry")
    def test_updates_when_changed(self, mock_reg, mock_remote, mock_decrypt, mock_update):
        record = MagicMock(
            auto_update=True, status="running",
            github_url="https://github.com/o/r", branch="main",
            last_commit_hash="old_hash", github_token_enc="",
        )
        # MagicMock の name は特殊属性なので configure_mock で設定
        record.configure_mock(name="srv")
        mock_reg.get_all.return_value = [record]
        with patch.object(deployer, "GITHUB_TOKEN", ""):
            result = deployer.check_and_update_all(_log)
        assert result == ["srv"]
        mock_update.assert_called_once_with("srv", _log)
