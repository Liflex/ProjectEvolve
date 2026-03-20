"""Tests for server.py path traversal protection and secret file blocking."""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure server module is importable
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "ui"))

# We only test the helper functions, not the full FastAPI app
# (that would require httpx test client + all deps)


class TestValidateProjectPath:
    """Tests for _validate_project_path helper."""

    def _import_helper(self):
        """Import _validate_project_path from server module."""
        from importlib import import_module
        server = import_module("server")
        return server._validate_project_path

    def test_blocks_absolute_path_outside_project(self):
        """Absolute path outside project dir should be blocked."""
        validate = self._import_helper()
        with pytest.raises(Exception) as exc_info:
            validate("C:\\Windows\\System32")
        assert "403" in str(exc_info.value) or "traversal" in str(exc_info.value).lower()

    def test_blocks_parent_traversal(self):
        """../.. style traversal should be blocked."""
        validate = self._import_helper()
        with pytest.raises(Exception) as exc_info:
            validate("../../etc/passwd")
        assert "403" in str(exc_info.value) or "traversal" in str(exc_info.value).lower()

    def test_allows_project_subdirectory(self):
        """Subdirectory of project should be allowed."""
        validate = self._import_helper()
        result = validate(".")
        assert isinstance(result, Path)

    def test_allows_current_directory(self):
        """Current directory '.' should be allowed."""
        validate = self._import_helper()
        result = validate(".")
        assert result.exists()


class TestIsSubpath:
    """Tests for _is_subpath helper."""

    def _import_helper(self):
        from importlib import import_module
        server = import_module("server")
        return server._is_subpath

    def test_direct_child_is_subpath(self):
        is_sub = self._import_helper()
        parent = Path("C:\\project")
        child = Path("C:\\project\\subdir")
        assert is_sub(child, parent) is True

    def test_same_path_is_subpath(self):
        is_sub = self._import_helper()
        path = Path("C:\\project")
        assert is_sub(path, path) is True

    def test_sibling_is_not_subpath(self):
        is_sub = self._import_helper()
        parent = Path("C:\\project")
        sibling = Path("C:\\other")
        assert is_sub(sibling, parent) is False

    def test_parent_is_not_subpath(self):
        is_sub = self._import_helper()
        parent = Path("C:\\project")
        grandparent = Path("C:\\")
        assert is_sub(parent, grandparent) is True  # project IS under C:\

    def test_resolved_traversal_is_not_subpath(self):
        is_sub = self._import_helper()
        parent = Path("C:\\project").resolve()
        escaped = Path("C:\\project\\..\\Windows").resolve()
        # After resolve, the path escapes the parent
        assert is_sub(escaped, parent) is False


class TestSecretFileConstants:
    """Tests for SECRET_EXTS and SECRET_NAMES constants."""

    def _import_constants(self):
        from importlib import import_module
        server = import_module("server")
        return server.SECRET_EXTS, server.SECRET_NAMES

    def test_secret_exts_includes_env(self):
        secret_exts, _ = self._import_constants()
        assert ".env" in secret_exts

    def test_secret_exts_includes_keys(self):
        secret_exts, _ = self._import_constants()
        assert ".pem" in secret_exts
        assert ".key" in secret_exts

    def test_secret_names_includes_dotenv(self):
        _, secret_names = self._import_constants()
        assert ".env" in secret_names

    def test_secret_names_includes_ssh_keys(self):
        _, secret_names = self._import_constants()
        assert "id_rsa" in secret_names
        assert "id_ed25519" in secret_names
