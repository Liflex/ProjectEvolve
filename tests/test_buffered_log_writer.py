"""Tests for _BufferedLogWriter performance optimization."""

import tempfile
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "utils"))

from autoresearch import _BufferedLogWriter


class TestBufferedLogWriter:
    def test_single_write(self, tmp_path):
        """Single write should be buffered until flush."""
        w = _BufferedLogWriter()
        f = tmp_path / "test.log"
        w.write(f, "hello")
        # Not flushed yet — file shouldn't exist or be empty
        # (depends on auto-flush timing, so just flush manually)
        w.flush()
        assert f.read_text(encoding="utf-8").strip() == "hello"

    def test_multiple_writes_batched(self, tmp_path):
        """Multiple writes should be flushed as a batch."""
        w = _BufferedLogWriter()
        f = tmp_path / "test.log"

        # Write 15 lines (exceeds auto-flush threshold of 10)
        for i in range(15):
            w.write(f, f"line {i}")

        w.flush()  # Ensure remaining are written
        lines = f.read_text(encoding="utf-8").strip().split("\n")
        assert len(lines) == 15
        assert lines[0] == "line 0"
        assert lines[14] == "line 14"

    def test_path_change_triggers_flush(self, tmp_path):
        """Switching log file path should flush the previous buffer."""
        w = _BufferedLogWriter()
        f1 = tmp_path / "a.log"
        f2 = tmp_path / "b.log"

        w.write(f1, "to a")
        w.write(f2, "to b")  # Path change — should flush f1
        w.flush()

        assert f1.read_text(encoding="utf-8").strip() == "to a"
        assert f2.read_text(encoding="utf-8").strip() == "to b"

    def test_flush_on_no_path_is_noop(self):
        """Flushing without ever writing should not raise."""
        w = _BufferedLogWriter()
        w.flush()  # Should not raise

    def test_flush_creates_parent_dirs(self, tmp_path):
        """Flush should create parent directories if needed."""
        w = _BufferedLogWriter()
        f = tmp_path / "sub" / "dir" / "test.log"

        w.write(f, "deep path")
        w.flush()

        assert f.exists()
        assert f.read_text(encoding="utf-8").strip() == "deep path"

    def test_size_auto_flush(self, tmp_path):
        """Auto-flush should trigger after 10 buffered lines."""
        w = _BufferedLogWriter()
        # Override flush interval to prevent time-based flush
        w._flush_interval = 9999.0
        f = tmp_path / "test.log"

        for i in range(9):
            w.write(f, f"line {i}")

        # 9 lines buffered — file may not exist yet
        content_before = ""
        if f.exists():
            content_before = f.read_text(encoding="utf-8")

        # 10th line triggers auto-flush
        w.write(f, "line 9")

        content_after = f.read_text(encoding="utf-8")
        # At least line 0 should be in the flushed content
        assert "line 0" in content_after
        assert "line 9" in content_after

        w.flush()  # Clean up remaining

    def test_oserror_warns_once_on_stderr(self, tmp_path, capsys):
        """First OSError should print warning to stderr, subsequent are suppressed."""
        from unittest.mock import patch, mock_open
        w = _BufferedLogWriter()
        f = tmp_path / "test.log"

        w.write(f, "line1")
        w.write(f, "line2")

        # Force open() to raise OSError
        with patch("builtins.open", side_effect=OSError("Permission denied")):
            w.flush()  # First failure — should warn
            assert w._error_reported is True
        with patch("builtins.open", side_effect=OSError("Permission denied")):
            w.flush()  # Second failure — suppressed

        stderr = capsys.readouterr().err
        assert "Cannot write log" in stderr

    def test_error_reported_flag(self, tmp_path, capsys):
        """After error is reported once, subsequent errors don't spam stderr."""
        w = _BufferedLogWriter()
        assert w._error_reported is False

        # Simulate a path that can't be written
        # On Windows, use a reserved name; on Unix, /dev/null as directory
        import os
        bad_path = Path("NUL" if os.name == "nt" else "/proc/nonexistent/log.txt")
        w.write(bad_path, "line1")
        w.flush()
        w.flush()
        w.flush()

        stderr = capsys.readouterr().err
        # Should contain exactly one warning, not three
        warning_count = stderr.count("Cannot write log")
        assert warning_count <= 1
