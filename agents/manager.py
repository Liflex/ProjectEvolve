"""Multi-session lifecycle management for Claude Code SDK."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Optional

from agents.session import ClaudeSession, SessionStatus

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages multiple Claude Code sessions with limits and cleanup."""

    def __init__(self, max_sessions: int = 5):
        self._sessions: Dict[str, ClaudeSession] = {}
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
    ) -> ClaudeSession:
        """Create a new Claude Code session."""
        session = ClaudeSession(cwd=cwd, resume_id=resume_id)
        await session.start()
        self._sessions[session.session_id] = session
        logger.info("Created session %s for cwd=%s", session.session_id, cwd)
        return session

    def get_session(self, session_id: str) -> Optional[ClaudeSession]:
        """Get a session by ID, or None if not found."""
        return self._sessions.get(session_id)

    async def cancel_session(self, session_id: str) -> bool:
        """Cancel and remove a session. Returns True if found."""
        session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        await session.cleanup()
        logger.info("Cancelled session %s", session_id)
        return True

    async def deactivate(self, session_id: str) -> None:
        """Mark session as inactive (called on WebSocket disconnect)."""
        session = self._sessions.get(session_id)
        if session:
            await session.cancel()
            logger.info("Deactivated session %s", session_id)
