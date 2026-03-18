"""Claude Code SDK session wrapper.

Wraps claude-code-sdk query() with async lifecycle management,
status tracking, and stream-json output parsing.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import asdict
from datetime import datetime
from enum import Enum
from typing import Any, AsyncIterator, Optional

logger = logging.getLogger(__name__)


class SessionStatus(str, Enum):
    STARTING = "starting"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    ERROR = "error"


class ClaudeSession:
    """Wrapper around claude-code-sdk query() with lifecycle management."""

    def __init__(
        self,
        cwd: str,
        session_id: Optional[str] = None,
        resume_id: Optional[str] = None,
        max_turns: int = 10,
        permission_mode: str = "accept_edits",
    ):
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.cwd = cwd
        self.resume_id = resume_id
        self.max_turns = max_turns
        self.permission_mode = permission_mode

        self.status = SessionStatus.STARTING
        self.created_at = datetime.now()
        self.message_count = 0
        self._task: Optional[asyncio.Task] = None
        self._query_result: Optional[Any] = None
        self._output_lines: list[str] = []
        self._error: Optional[str] = None

    async def start(self) -> None:
        """Mark session as active (ready to receive messages)."""
        self.status = SessionStatus.ACTIVE
        logger.info("Session %s started for cwd=%s", self.session_id, self.cwd)

    async def send(
        self,
        prompt: str,
        continue_conversation: bool = True,
    ) -> AsyncIterator[dict]:
        """Send a prompt to the agent and yield stream events."""
        if self.status not in (SessionStatus.ACTIVE, SessionStatus.STARTING):
            raise RuntimeError(
                f"Cannot send to session in state {self.status.value}"
            )

        self.status = SessionStatus.ACTIVE
        self.message_count += 1

        try:
            from claude_code_sdk import query, ClaudeCodeOptions

            options = ClaudeCodeOptions(
                cwd=self.cwd,
                max_turns=self.max_turns,
                permission_mode=self.permission_mode,
            )

            if self.resume_id:
                options.resume = self.resume_id
            elif continue_conversation and self.message_count > 1:
                options.continue_conversation = True

            logger.debug(
                "Session %s: sending query (turn %d, resume=%s)",
                self.session_id, self.message_count, self.resume_id,
            )

            # query() is an async generator (not awaitable) — iterate directly
            self._query_result = query(prompt=prompt, options=options)
            async for message in self._query_result:
                # SDK Message types are dataclasses — convert to dict
                try:
                    event = asdict(message)
                except Exception:
                    event = {"type": str(type(message).__name__), "data": str(message)}
                # Tag with message type name for the WebSocket protocol
                event.setdefault("type", type(message).__name__.removesuffix("Message").lower())
                self._output_lines.append(json.dumps(event, default=str))
                yield event

            self.status = SessionStatus.COMPLETED
            logger.info("Session %s: query completed", self.session_id)

        except asyncio.CancelledError:
            self.status = SessionStatus.CANCELLED
            logger.info("Session %s: cancelled", self.session_id)
            raise
        except Exception as e:
            self.status = SessionStatus.ERROR
            self._error = str(e)
            logger.error("Session %s: error: %s", self.session_id, e)
            yield {"type": "error", "message": str(e)}

    async def cancel(self) -> None:
        """Cancel any running query task."""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.status = SessionStatus.CANCELLED

    async def cleanup(self) -> None:
        """Release all resources held by this session."""
        await self.cancel()
        self._output_lines.clear()
        self._query_result = None
        logger.info("Session %s: cleaned up", self.session_id)

    def get_output(self) -> str:
        """Return all collected output as a single string."""
        return "\n".join(self._output_lines)

    @property
    def is_active(self) -> bool:
        return self.status in (SessionStatus.ACTIVE, SessionStatus.STARTING)

    def to_dict(self) -> dict:
        """Serializable state for API responses."""
        return {
            "session_id": self.session_id,
            "cwd": self.cwd,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "message_count": self.message_count,
            "error": self._error,
        }
