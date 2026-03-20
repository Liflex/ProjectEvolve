"""Multi-session lifecycle management for Claude Code SDK."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional

from agents.session import ClaudeSession, SessionStatus

logger = logging.getLogger(__name__)

# Grace period before a disconnected session is cleaned up (seconds).
# Must be long enough for exponential backoff reconnect (max 30s) + margin.
_GRACE_PERIOD_SECONDS = 60


class SessionManager:
    """Manages multiple Claude Code sessions with limits and cleanup.

    Sessions are not immediately destroyed on WebSocket disconnect.
    Instead, a grace period timer starts. If the client reconnects within
    the grace period, the timer is cancelled and the session resumes.
    This prevents session loss on transient network glitches.
    """

    def __init__(self, max_sessions: int = 5):
        self._sessions: Dict[str, ClaudeSession] = {}
        self._cleanup_timers: Dict[str, asyncio.Task] = {}
        self._max_sessions = max_sessions

    @property
    def active_count(self) -> int:
        return sum(1 for s in self._sessions.values() if s.is_active)

    def is_at_limit(self) -> bool:
        return self.active_count >= self._max_sessions

    async def create_session(
        self,
        cwd: str,
        resume_id: Optional[str] = None,
        **kwargs,
    ) -> ClaudeSession:
        """Create a new Claude Code session."""
        session = ClaudeSession(cwd=cwd, resume_id=resume_id, **kwargs)
        await session.start()
        self._sessions[session.session_id] = session
        logger.info("Created session %s for cwd=%s", session.session_id, cwd)
        return session

    def get_session(self, session_id: str) -> Optional[ClaudeSession]:
        """Get a session by ID, or None if not found."""
        return self._sessions.get(session_id)

    async def cancel_session(self, session_id: str) -> bool:
        """Cancel and remove a session immediately. Returns True if found.

        Used for explicit user actions (close tab). No grace period —
        the session is destroyed right away.
        """
        self._cancel_cleanup_timer(session_id)
        session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        await session.cleanup()
        logger.info("Cancelled session %s", session_id)
        return True

    def reactivate(self, session_id: str) -> bool:
        """Cancel grace period timer if client reconnects in time.

        Returns True if the session exists and was in grace period.
        The session can immediately accept new messages.
        """
        session = self._sessions.get(session_id)
        if session is None:
            return False
        timer_cancelled = self._cancel_cleanup_timer(session_id)
        if timer_cancelled:
            logger.info(
                "Session %s reactivated (grace period cancelled)", session_id
            )
        return True

    async def deactivate(self, session_id: str) -> None:
        """Mark session as disconnected; start grace period cleanup timer.

        Called when the WebSocket disconnects. The session is NOT cancelled
        immediately — a grace period timer starts. If the client reconnects
        within the grace period, ``reactivate()`` cancels the timer and
        the session resumes normally.

        When the timer fires, the running query is cancelled and the session
        is removed from the manager.
        """
        session = self._sessions.get(session_id)
        if session is None:
            return

        # Cancel any existing timer before scheduling a new one
        self._cancel_cleanup_timer(session_id)

        # Schedule cleanup after grace period
        loop = asyncio.get_running_loop()
        self._cleanup_timers[session_id] = loop.create_task(
            self._grace_period_cleanup(session_id)
        )
        logger.info(
            "Session %s deactivated (grace period %ds)",
            session_id, _GRACE_PERIOD_SECONDS,
        )

    async def _grace_period_cleanup(self, session_id: str) -> None:
        """Wait for grace period, then cancel and remove the session."""
        try:
            await asyncio.sleep(_GRACE_PERIOD_SECONDS)
        except asyncio.CancelledError:
            # Timer was cancelled — session was reactivated
            return

        session = self._sessions.pop(session_id, None)
        self._cleanup_timers.pop(session_id, None)

        if session is not None:
            await session.cancel()
            logger.info(
                "Session %s cleaned up after grace period expired", session_id
            )

    def _cancel_cleanup_timer(self, session_id: str) -> bool:
        """Cancel a pending grace period timer. Returns True if timer existed."""
        timer = self._cleanup_timers.pop(session_id, None)
        if timer is not None and not timer.done():
            timer.cancel()
            return True
        return False
