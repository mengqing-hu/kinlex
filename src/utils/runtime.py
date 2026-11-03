"""Cache, prompt files, atomic output, and run telemetry."""

import hashlib
import json
import logging
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from string import Template
from typing import Literal

from pydantic import BaseModel

from config import PIPELINE_ROOT, REPO_ROOT

DATA_ROOT = REPO_ROOT / "data" / "pipeline"
PROMPTS_ROOT = PIPELINE_ROOT / "prompts"
LOGGER_NAME = "kinlex"
Outcome = Literal["succeeded", "failed", "cached"]


def cache_key(*parts: object) -> str:
    payload = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def read_prompt(name: str) -> Template:
    return Template((PROMPTS_ROOT / f"{name}.md").read_text(encoding="utf-8"))


def _data_dir(language: str, name: str) -> Path:
    path = DATA_ROOT / language / name
    path.mkdir(parents=True, exist_ok=True)
    return path


class Cache:
    def __init__(self, language: str, task: str) -> None:
        self.root = _data_dir(language, "cache") / task

    def get[T: BaseModel](self, key: str, model: type[T]) -> T | None:
        path = self.root / key[:2] / f"{key}.json"
        return model.model_validate_json(path.read_text("utf-8")) if path.exists() else None

    def set(self, key: str, value: BaseModel) -> None:
        path = self.root / key[:2] / f"{key}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(value.model_dump_json(), encoding="utf-8")
        temporary.replace(path)


@dataclass
class RunSummary:
    task: str
    language: str
    total: int = 0
    succeeded: int = 0
    failed: int = 0
    cached: int = 0
    model_calls: int = 0
    started: float = field(default_factory=time.monotonic)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def record(self, outcome: Outcome) -> None:
        with self.lock:
            self.total += 1
            setattr(self, outcome, getattr(self, outcome) + 1)

    def add_model_calls(self, count: int) -> None:
        with self.lock:
            self.model_calls += count

    def write(self) -> None:
        get_logger().info(
            "summary task=%s language=%s total=%d succeeded=%d failed=%d cached=%d "
            "model_calls=%d seconds=%.1f",
            self.task,
            self.language,
            self.total,
            self.succeeded,
            self.failed,
            self.cached,
            self.model_calls,
            time.monotonic() - self.started,
        )


def setup_logging(task: str, language: str) -> None:
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False
    terminal = logging.StreamHandler(sys.stderr)
    terminal.setFormatter(logging.Formatter("%(levelname)-7s %(message)s"))
    logger.addHandler(terminal)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file = logging.FileHandler(
        _data_dir(language, "logs") / f"{task}_{stamp}.log", encoding="utf-8"
    )
    file.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(message)s"))
    logger.addHandler(file)


def get_logger() -> logging.Logger:
    return logging.getLogger(LOGGER_NAME)


def log_model_call(word: str, model: str, *, cached: bool, valid: bool, seconds: float = 0) -> None:
    get_logger().info(
        "call word=%s model=%s seconds=%.1f cached=%s valid=%s",
        word,
        model,
        seconds,
        cached,
        valid,
    )
