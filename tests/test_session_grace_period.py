"""Tests for SessionManager grace period on WebSocket disconnect."""

import asyncio
import pytest

from agents.manager import SessionManager, _GRACE_PERIOD_SECONDS
from agents.session import ClaudeSession, SessionStatus


class FakeSession:
    """Lightweight mock of ClaudeSession for testing manager lifecycle."""

    def __init__(self, session_id: str = "test-session"):
        self.session_id = session_id
        self.cwd = "/tmp/test"
        self.status = SessionStatus.ACTIVE
        self.message_count = 0
        self.cancelled = False
        self.cleaned_up = False
        self.resume_id = None

    async def start(self):
        self.status = SessionStatus.ACTIVE

    async def cancel(self):
        self.cancelled = True
        self.status = SessionStatus.CANCELLED

    async def cleanup(self):
        self.cleaned_up = True
        await self.cancel()

    @property
    def is_active(self):
        return self.status in (SessionStatus.ACTIVE, SessionStatus.STARTING)

    def to_dict(self):
        return {
            "session_id": self.session_id,
            "cwd": self.cwd,
            "status": self.status.value,
        }


@pytest.fixture
def manager():
    return SessionManager(max_sessions=3)


@pytest.mark.asyncio
async def test_deactivate_does_not_cancel_immediately(manager: SessionManager):
    """deactivate() should NOT cancel the session — only start a timer."""
    session = FakeSession("s1")
    manager._sessions["s1"] = session

    await manager.deactivate("s1")

    # Session should still exist and NOT be cancelled
    assert manager.get_session("s1") is session
    assert not session.cancelled


@pytest.mark.asyncio
async def test_reactivate_cancels_grace_period(manager: SessionManager):
    """reactivate() should cancel the grace period timer."""
    session = FakeSession("s1")
    manager._sessions["s1"] = session

    await manager.deactivate("s1")
    assert "s1" in manager._cleanup_timers

    result = manager.reactivate("s1")

    assert result is True
    assert "s1" not in manager._cleanup_timers
    assert not session.cancelled


@pytest.mark.asyncio
async def test_reactivate_nonexistent_returns_false(manager: SessionManager):
    """reactivate() should return False for unknown sessions."""
    assert manager.reactivate("nonexistent") is False


@pytest.mark.asyncio
async def test_grace_period_fires_and_cancels(manager: SessionManager):
    """After grace period, the session should be cancelled and removed."""
    # Use a very short grace period for testing
    import agents.manager as mgr
    original = mgr._GRACE_PERIOD_SECONDS
    try:
        mgr._GRACE_PERIOD_SECONDS = 0.05  # 50ms
        session = FakeSession("s1")
        manager._sessions["s1"] = session

        await manager.deactivate("s1")

        # Wait for grace period to expire
        await asyncio.sleep(0.15)

        # Session should be cancelled and removed
        assert manager.get_session("s1") is None
        assert session.cancelled
        assert "s1" not in manager._cleanup_timers
    finally:
        mgr._GRACE_PERIOD_SECONDS = original


@pytest.mark.asyncio
async def test_cancel_session_immediate_no_grace(manager: SessionManager):
    """cancel_session() should immediately remove without grace period."""
    session = FakeSession("s1")
    manager._sessions["s1"] = session

    # Set up a grace period first
    await manager.deactivate("s1")
    assert "s1" in manager._cleanup_timers

    # cancel_session should override the grace period
    result = await manager.cancel_session("s1")

    assert result is True
    assert manager.get_session("s1") is None
    assert session.cancelled
    assert session.cleaned_up
    assert "s1" not in manager._cleanup_timers


@pytest.mark.asyncio
async def test_cancel_session_nonexistent(manager: SessionManager):
    """cancel_session() should return False for unknown sessions."""
    assert await manager.cancel_session("nonexistent") is False


@pytest.mark.asyncio
async def test_deactivate_nonexistent_no_error(manager: SessionManager):
    """deactivate() should silently ignore unknown sessions."""
    await manager.deactivate("nonexistent")  # Should not raise


@pytest.mark.asyncio
async def test_double_deactivate_resets_timer(manager: SessionManager):
    """Calling deactivate twice should reset the grace period timer."""
    session = FakeSession("s1")
    manager._sessions["s1"] = session

    await manager.deactivate("s1")
    first_timer = manager._cleanup_timers.get("s1")

    await manager.deactivate("s1")
    second_timer = manager._cleanup_timers.get("s1")

    # Timers should be different objects (first was cancelled, new one created)
    assert first_timer is not second_timer
    assert not session.cancelled
