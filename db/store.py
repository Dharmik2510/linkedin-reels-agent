"""SQLite persistence for runs, agent steps, and feedback."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

_DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "reelify.db"
_lock = threading.Lock()


def db_path() -> Path:
    raw = os.getenv("REELIFY_DB_PATH", str(_DEFAULT_DB))
    return Path(raw)


def _conn() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = _conn()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    num_posts INTEGER NOT NULL,
                    tone TEXT NOT NULL,
                    language TEXT NOT NULL,
                    cost_usd REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                );
                CREATE TABLE IF NOT EXISTS run_steps (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    post_index INTEGER,
                    agent TEXT NOT NULL,
                    step TEXT NOT NULL,
                    status TEXT NOT NULL,
                    message TEXT NOT NULL,
                    model TEXT,
                    cost_usd REAL NOT NULL DEFAULT 0,
                    duration_ms INTEGER,
                    reasoning_public TEXT,
                    input_summary TEXT,
                    output_summary TEXT,
                    artifact_json TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (run_id) REFERENCES runs(id)
                );
                CREATE INDEX IF NOT EXISTS idx_steps_run ON run_steps(run_id);
                CREATE TABLE IF NOT EXISTS feedback (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    step_id TEXT NOT NULL,
                    post_index INTEGER,
                    rating TEXT NOT NULL,
                    comment TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (run_id) REFERENCES runs(id),
                    FOREIGN KEY (step_id) REFERENCES run_steps(id)
                );
                """
            )
            conn.commit()
        finally:
            conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_run(
    run_id: str,
    *,
    num_posts: int,
    tone: str,
    language: str,
) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.execute(
                """
                INSERT INTO runs (id, status, num_posts, tone, language, cost_usd, created_at)
                VALUES (?, 'running', ?, ?, ?, 0, ?)
                """,
                (run_id, num_posts, tone, language, _now()),
            )
            conn.commit()
        finally:
            conn.close()


def finish_run(run_id: str, *, status: str, cost_usd: float) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.execute(
                """
                UPDATE runs SET status = ?, cost_usd = ?, completed_at = ? WHERE id = ?
                """,
                (status, cost_usd, _now(), run_id),
            )
            conn.commit()
        finally:
            conn.close()


def add_run_cost(run_id: str, amount: float) -> None:
    with _lock:
        conn = _conn()
        try:
            conn.execute(
                "UPDATE runs SET cost_usd = cost_usd + ? WHERE id = ?",
                (amount, run_id),
            )
            conn.commit()
        finally:
            conn.close()


def insert_step(
    *,
    run_id: str,
    step_id: str,
    post_index: int | None,
    agent: str,
    step: str,
    status: str,
    message: str,
    model: str | None = None,
    cost_usd: float = 0.0,
    duration_ms: int | None = None,
    reasoning_public: str | None = None,
    input_summary: str | None = None,
    output_summary: str | None = None,
    artifact: dict[str, Any] | None = None,
) -> None:
    with _lock:
        conn = _conn()
        try:
            existing = conn.execute(
                "SELECT id FROM run_steps WHERE id = ?", (step_id,)
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE run_steps SET
                        status = ?, message = ?, model = ?, cost_usd = ?,
                        duration_ms = ?, reasoning_public = ?,
                        output_summary = ?, artifact_json = ?
                    WHERE id = ?
                    """,
                    (
                        status,
                        message,
                        model,
                        cost_usd,
                        duration_ms,
                        reasoning_public,
                        output_summary,
                        json.dumps(artifact) if artifact else None,
                        step_id,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO run_steps (
                        id, run_id, post_index, agent, step, status, message,
                        model, cost_usd, duration_ms, reasoning_public,
                        input_summary, output_summary, artifact_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        step_id,
                        run_id,
                        post_index,
                        agent,
                        step,
                        status,
                        message,
                        model,
                        cost_usd,
                        duration_ms,
                        reasoning_public,
                        input_summary,
                        output_summary,
                        json.dumps(artifact) if artifact else None,
                        _now(),
                    ),
                )
            conn.commit()
        finally:
            conn.close()


def list_steps(run_id: str, post_index: int | None = None) -> list[dict[str, Any]]:
    with _lock:
        conn = _conn()
        try:
            if post_index is None:
                rows = conn.execute(
                    "SELECT * FROM run_steps WHERE run_id = ? ORDER BY created_at",
                    (run_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM run_steps WHERE run_id = ? AND post_index = ? ORDER BY created_at",
                    (run_id, post_index),
                ).fetchall()
            return [_row_to_step(r) for r in rows]
        finally:
            conn.close()


def get_run(run_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _conn()
        try:
            row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
            if not row:
                return None
            return dict(row)
        finally:
            conn.close()


def insert_feedback(
    *,
    run_id: str,
    step_id: str,
    post_index: int | None,
    rating: str,
    comment: str | None,
) -> str:
    fid = str(uuid4())
    with _lock:
        conn = _conn()
        try:
            conn.execute(
                """
                INSERT INTO feedback (id, run_id, step_id, post_index, rating, comment, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (fid, run_id, step_id, post_index, rating, comment, _now()),
            )
            conn.commit()
        finally:
            conn.close()
    return fid


def _row_to_step(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    if d.get("artifact_json"):
        try:
            d["artifact"] = json.loads(d["artifact_json"])
        except json.JSONDecodeError:
            d["artifact"] = None
    else:
        d["artifact"] = None
    return d
