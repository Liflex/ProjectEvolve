"""Claude Code SDK session wrapper.

Wraps claude-code-sdk ClaudeSDKClient with async lifecycle management,
status tracking, and stream-json output parsing.

Uses ClaudeSDKClient (persistent bidirectional connection) for proper
multi-turn conversation support, instead of the stateless query() function.
The SDK documentation explicitly states: "For interactive, stateful
conversations, use ClaudeSDKClient instead" of query().
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

from claude_code_sdk.types import AssistantMessage, ResultMessage, ToolUseBlock

logger = logging.getLogger(__name__)


class SessionStatus(str, Enum):
    STARTING = "starting"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    ERROR = "error"


class ClaudeSession:
    """Wrapper around claude-code-sdk ClaudeSDKClient with lifecycle management.

    Uses ClaudeSDKClient for persistent bidirectional communication, which
    properly maintains multi-turn conversation context across messages.
    The first send() creates and connects the client. Subsequent send() calls
    reuse the existing connection for true conversation continuity.

    Key differences from the previous query()-based approach:
    - Persistent connection: no subprocess spawn per message
    - True multi-turn: SDK maintains conversation state internally
    - interrupt(): can stop a running response mid-stream
    - resume: first message can resume a previous conversation via resume_id
    """

    def __init__(
        self,
        cwd: str,
        session_id: Optional[str] = None,
        resume_id: Optional[str] = None,
        max_turns: int = 10,
        permission_mode: str = "acceptEdits",
        append_system_prompt: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.cwd = cwd
        self.resume_id = resume_id
        self.max_turns = max_turns
        self.permission_mode = permission_mode
        self.append_system_prompt = append_system_prompt
        self.model = model

        self.status = SessionStatus.STARTING
        self.created_at = datetime.now()
        self.message_count = 0
        self._client: Optional[Any] = None  # ClaudeSDKClient, lazy import
        self._output_lines: list[str] = []
        self._error: Optional[str] = None

    async def start(self) -> None:
        """Mark session as active (ready to receive messages)."""
        self.status = SessionStatus.ACTIVE
        logger.info("Session %s started for cwd=%s", self.session_id, self.cwd)

    async def send(
        self,
        prompt,
        continue_conversation: bool = True,
    ) -> AsyncIterator[dict]:
        """Send a prompt to the agent and yield stream events.

        Uses ClaudeSDKClient for persistent multi-turn. First message creates
        the client connection; subsequent messages reuse it via query().

        Args:
            prompt: str (text-only) or list of content blocks (multimodal).
                    Multimodal: [{"type":"text","text":"..."},
                                 {"type":"image","source":{"type":"base64","media_type":"image/png","data":"..."}}]
            continue_conversation: Kept for API compat; ClaudeSDKClient always
                                   maintains conversation context via persistent
                                   connection. Ignored in practice.
        """
        if self.status not in (SessionStatus.ACTIVE, SessionStatus.STARTING):
            logger.info(
                "Session %s: re-activating from %s",
                self.session_id, self.status.value,
            )

        self.status = SessionStatus.ACTIVE
        self.message_count += 1

        try:
            from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient
            import os

            clean_env = {}
            for var in ("CLAUDECODE", "CLAUDE_SESSION_ID"):
                if var in os.environ:
                    clean_env[var] = ""

            options = ClaudeCodeOptions(
                cwd=self.cwd,
                max_turns=self.max_turns,
                permission_mode=self.permission_mode,
                env=clean_env,
            )

            if self.append_system_prompt:
                options.append_system_prompt = self.append_system_prompt
            if self.model:
                options.model = self.model

            # Resume previous conversation on first message only.
            # After that, ClaudeSDKClient maintains context via the
            # persistent connection — no continue_conversation flag needed.
            if self.resume_id and self.message_count == 1:
                options.resume = self.resume_id
                self.resume_id = None

            # Format prompt for ClaudeSDKClient:
            # - str → passed directly
            # - list (multimodal) → wrapped as async iterable message dict
            if isinstance(prompt, list):
                async def _multimodal_stream():
                    yield {"type": "user", "message": {"role": "user", "content": prompt}}
                prompt_arg = _multimodal_stream()
            else:
                prompt_arg = prompt

            # First message: create client and connect.
            # Subsequent messages: reuse existing connection via query().
            if self._client is None:
                self._client = ClaudeSDKClient(options=options)
                await self._client.connect(prompt=prompt_arg)
                logger.info(
                    "Session %s: connected (turn %d, resume=%s)",
                    self.session_id, self.message_count,
                    "yes" if options.resume else "no",
                )
            else:
                await self._client.query(prompt=prompt_arg)
                logger.info(
                    "Session %s: queried (turn %d)",
                    self.session_id, self.message_count,
                )

            # Stream response until ResultMessage (receive_response handles this).
            # Decompose SDK messages into events matching the client's expected
            # format: "assistant" (text+thinking), "tool" (tool calls), "result".
            async for message in self._client.receive_response():
                if isinstance(message, AssistantMessage):
                    # Yield full assistant event — client extracts text + thinking
                    event = asdict(message)
                    event["type"] = "assistant"
                    self._output_lines.append(json.dumps(event, default=str))
                    yield event

                    # Yield separate tool events for each ToolUseBlock
                    for block in message.content:
                        if isinstance(block, ToolUseBlock):
                            tool_evt = {
                                "type": "tool",
                                "name": block.name,
                                "input": block.input,
                                "tool_use_id": block.id,
                            }
                            self._output_lines.append(json.dumps(tool_evt, default=str))
                            yield tool_evt

                elif isinstance(message, ResultMessage):
                    event = asdict(message)
                    event["type"] = "result"
                    self._output_lines.append(json.dumps(event, default=str))
                    yield event

                else:
                    # SystemMessage, UserMessage, StreamEvent, etc.
                    try:
                        event = asdict(message)
                    except Exception:
                        event = {"type": str(type(message).__name__), "data": str(message)}
                    event.setdefault("type", type(message).__name__.removesuffix("Message").lower())
                    self._output_lines.append(json.dumps(event, default=str))
                    yield event

            self.status = SessionStatus.COMPLETED
            logger.info("Session %s: turn %d completed", self.session_id, self.message_count)

        except asyncio.CancelledError:
            self.status = SessionStatus.CANCELLED
            logger.info("Session %s: cancelled on turn %d", self.session_id, self.message_count)
            raise
        except Exception as e:
            self.status = SessionStatus.ERROR
            self._error = str(e)
            logger.error("Session %s: error on turn %d: %s", self.session_id, self.message_count, e)
            yield {"type": "error", "message": str(e)}

    async def cancel(self) -> None:
        """Interrupt the running query via ClaudeSDKClient.interrupt().

        Sends an interrupt signal to the SDK subprocess, causing it to
        stop the current response and produce a ResultMessage.
        """
        if self._client is not None:
            try:
                await self._client.interrupt()
                logger.info("Session %s: interrupted", self.session_id)
            except Exception as e:
                logger.debug("Session %s: interrupt failed: %s", self.session_id, e)
        self.status = SessionStatus.CANCELLED

    async def cleanup(self) -> None:
        """Release all resources held by this session.

        Interrupts any running query, disconnects the SDK client,
        and clears output buffers.
        """
        await self.cancel()
        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception as e:
                logger.debug("Session %s: disconnect error: %s", self.session_id, e)
            self._client = None
        self._output_lines.clear()
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
            "config": {
                "max_turns": self.max_turns,
                "permission_mode": self.permission_mode,
                "model": self.model,
                "has_system_prompt": bool(self.append_system_prompt),
            },
        }
