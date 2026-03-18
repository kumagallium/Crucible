import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from pydantic import ValidationError

from models import DeployJob, LogsResponse, RegisterRequest, ServerRecord


class TestRegisterRequestName:
    def test_name_none_is_allowed(self):
        req = RegisterRequest(name=None, github_url="https://github.com/owner/repo")
        assert req.name is None

    def test_name_valid_lowercase_alphanumeric(self):
        req = RegisterRequest(name="my-server-01", github_url="https://github.com/owner/repo")
        assert req.name == "my-server-01"

    def test_name_minimum_length_three_chars(self):
        req = RegisterRequest(name="a0b", github_url="https://github.com/owner/repo")
        assert req.name == "a0b"

    def test_name_rejects_two_char_string(self):
        with pytest.raises(ValidationError, match="name"):
            RegisterRequest(name="ab", github_url="https://github.com/owner/repo")

    def test_name_rejects_uppercase(self):
        with pytest.raises(ValidationError, match="name"):
            RegisterRequest(name="My-Server", github_url="https://github.com/owner/repo")

    def test_name_rejects_leading_hyphen(self):
        with pytest.raises(ValidationError, match="name"):
            RegisterRequest(name="-my-server", github_url="https://github.com/owner/repo")

    def test_name_rejects_trailing_hyphen(self):
        with pytest.raises(ValidationError, match="name"):
            RegisterRequest(name="my-server-", github_url="https://github.com/owner/repo")


class TestRegisterRequestGithubUrl:
    def test_valid_github_url(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo")
        assert req.github_url == "https://github.com/owner/repo"

    def test_valid_github_url_with_nested_path(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo/tree/main/subdir")
        assert "owner/repo" in req.github_url

    def test_rejects_http_url(self):
        with pytest.raises(ValidationError, match="github_url"):
            RegisterRequest(github_url="http://github.com/owner/repo")

    def test_rejects_non_github_url(self):
        with pytest.raises(ValidationError, match="github_url"):
            RegisterRequest(github_url="https://gitlab.com/owner/repo")


class TestRegisterRequestBranch:
    def test_default_branch_is_main(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo")
        assert req.branch == "main"

    def test_single_char_branch(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo", branch="v")
        assert req.branch == "v"

    def test_branch_with_slash(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo", branch="feat/new-tool")
        assert req.branch == "feat/new-tool"

    def test_rejects_double_dot(self):
        with pytest.raises(ValidationError, match="branch"):
            RegisterRequest(github_url="https://github.com/owner/repo", branch="a..b")

    def test_rejects_leading_slash(self):
        with pytest.raises(ValidationError, match="branch"):
            RegisterRequest(github_url="https://github.com/owner/repo", branch="/main")

    def test_rejects_trailing_slash(self):
        with pytest.raises(ValidationError, match="branch"):
            RegisterRequest(github_url="https://github.com/owner/repo", branch="main/")


class TestRegisterRequestEnvVars:
    def test_valid_env_vars(self):
        req = RegisterRequest(
            github_url="https://github.com/owner/repo",
            env_vars={"API_KEY": "secret", "_INTERNAL": "val"},
        )
        assert req.env_vars == {"API_KEY": "secret", "_INTERNAL": "val"}

    def test_rejects_env_var_starting_with_digit(self):
        with pytest.raises(ValidationError, match="環境変数名が不正"):
            RegisterRequest(
                github_url="https://github.com/owner/repo",
                env_vars={"1BAD": "val"},
            )

    def test_rejects_env_var_with_special_chars(self):
        with pytest.raises(ValidationError, match="環境変数名が不正"):
            RegisterRequest(
                github_url="https://github.com/owner/repo",
                env_vars={"MY-VAR": "val"},
            )


class TestRegisterRequestDefaults:
    def test_group_default_is_user(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo")
        assert req.group == "user"

    def test_transport_default_is_auto(self):
        req = RegisterRequest(github_url="https://github.com/owner/repo")
        assert req.transport == "auto"

    def test_transport_rejects_invalid_value(self):
        with pytest.raises(ValidationError):
            RegisterRequest(github_url="https://github.com/owner/repo", transport="grpc")


class TestServerRecord:
    def test_defaults(self):
        rec = ServerRecord(
            name="test",
            display_name="Test",
            description="desc",
            icon="T",
            github_url="https://github.com/o/r",
            branch="main",
            group="user",
            port=8080,
            static_ip="192.168.1.1",
        )
        assert rec.status == "deploying"
        assert rec.error_message is None
        assert rec.dify_registered is False
        assert rec.endpoint_path == "/sse"
        assert rec.github_token_enc == ""
        assert rec.created_at.endswith("Z")
        assert rec.updated_at.endswith("Z")


class TestDeployJob:
    def test_defaults(self):
        job = DeployJob(job_id="j-123", server_name="my-server")
        assert job.status == "pending"
        assert job.logs == []
        assert job.finished_at is None
        assert job.created_at.endswith("Z")


class TestLogsResponse:
    def test_construction(self):
        resp = LogsResponse(job_id="j-1", status="running", logs=["line1", "line2"], total=2)
        assert resp.job_id == "j-1"
        assert resp.status == "running"
        assert resp.logs == ["line1", "line2"]
        assert resp.total == 2
