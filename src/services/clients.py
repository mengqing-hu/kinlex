"""OpenAI-compatible LLM, TTS and speech recognition clients."""

import random
import threading
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from config import Config, Settings


class ProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class Voice:
    name: str
    instructions: str | None = None

    @property
    def label(self) -> str:
        return f"{self.name}; {self.instructions}" if self.instructions else self.name


DEFAULT_TEMPERATURE = 0.2


class LLMProvider(Protocol):
    def complete(
        self, model: str, system: str, prompt: str, temperature: float | None = None
    ) -> str: ...


class TTSProvider(Protocol):
    model: str

    def synthesize(self, text: str, voice: Voice) -> bytes: ...


class STTProvider(Protocol):
    model: str

    def transcribe(self, audio: bytes, filename: str, language: str) -> dict[str, Any]: ...


_RETRYABLE = {408, 409, 429, 500, 502, 503, 504}
_ATTEMPTS = 6
# A 429 means the key's parallel requests are taken. They free up as other requests finish, and a
# long completion holds one for a minute or two; anything else sharing the key (the website's chat)
# takes one too. So a 429 is waited out for about five minutes rather than one.
_RATE_LIMITED_ATTEMPTS = 10
_MAX_WAIT_SECONDS = 60


def _wait_seconds(attempt: int) -> float:
    # The jitter keeps parallel requests that were turned away together from coming back together.
    return min(2.0**attempt, _MAX_WAIT_SECONDS) + random.uniform(0, 1)


def _post(client: httpx.Client, path: str, **kwargs: object) -> httpx.Response:
    attempt = 0
    while True:
        attempt += 1
        try:
            response = client.post(path, **kwargs)  # type: ignore[arg-type]
        except httpx.TransportError as error:
            if attempt >= _ATTEMPTS:
                raise ProviderError(f"POST {path} failed: {error}") from error
            time.sleep(_wait_seconds(attempt))
            continue
        attempts = _RATE_LIMITED_ATTEMPTS if response.status_code == 429 else _ATTEMPTS
        if response.status_code not in _RETRYABLE or attempt >= attempts:
            if response.is_error:
                raise ProviderError(
                    f"POST {path} returned {response.status_code}: {response.text[:300]}"
                )
            return response
        retry_after = response.headers.get("retry-after", "")
        time.sleep(max(_wait_seconds(attempt), int(retry_after) if retry_after.isdigit() else 0))


class _Limiter:
    def __init__(self, per_minute: int) -> None:
        self.interval = 60.0 / per_minute
        self.next_request = 0.0
        self.lock = threading.Lock()

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            start = max(now, self.next_request)
            self.next_request = start + self.interval
        time.sleep(start - now)


class _LLM:
    def __init__(
        self,
        client: httpx.Client,
        limits: dict[str, int],
        reasoning_effort: str | None = None,
    ) -> None:
        self.client = client
        self.limiters = {model: _Limiter(rate) for model, rate in limits.items()}
        self.reasoning_effort = reasoning_effort

    def complete(
        self, model: str, system: str, prompt: str, temperature: float | None = None
    ) -> str:
        if model in self.limiters:
            self.limiters[model].wait()
        response = _post(
            self.client,
            "/chat/completions",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": DEFAULT_TEMPERATURE if temperature is None else temperature,
                **({"reasoning_effort": self.reasoning_effort} if self.reasoning_effort else {}),
            },
        )
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise ProviderError("unexpected chat response") from error
        if not isinstance(content, str) or not content.strip():
            raise ProviderError(f"{model} returned an empty message")
        return content


class _TTS:
    def __init__(self, client: httpx.Client, model: str) -> None:
        self.client = client
        self.model = model

    def synthesize(self, text: str, voice: Voice) -> bytes:
        body: dict[str, object] = {
            "model": self.model,
            "voice": voice.name,
            "input": text,
            "response_format": "mp3",
        }
        if voice.instructions:
            body["instructions"] = voice.instructions
        return _post(self.client, "/audio/speech", json=body).content


class _STT:
    def __init__(self, client: httpx.Client, model: str) -> None:
        self.client = client
        self.model = model

    def transcribe(self, audio: bytes, filename: str, language: str) -> dict[str, Any]:
        """The text in segments with their start and end in seconds (verbose_json)."""
        response = _post(
            self.client,
            "/audio/transcriptions",
            data={"model": self.model, "language": language, "response_format": "verbose_json"},
            files={"file": (filename, audio)},
        )
        try:
            result: dict[str, Any] = response.json()
        except ValueError as error:
            raise ProviderError("unexpected transcription response") from error
        return result


def model_client(settings: Settings) -> httpx.Client:
    settings.require("scads_api_url", "scads_api_key")
    return httpx.Client(
        base_url=settings.scads_api_url.rstrip("/"),
        headers={"Authorization": f"Bearer {settings.scads_api_key.get_secret_value()}"},
        timeout=httpx.Timeout(180.0, connect=15.0),
    )


def create_llm(client: httpx.Client, config: Config) -> LLMProvider:
    llm = config.providers.llm
    return _LLM(client, llm.rate_limits, llm.reasoning_effort)


def create_tts(client: httpx.Client, config: Config) -> TTSProvider:
    return _TTS(client, config.providers.tts.model)


def create_stt(client: httpx.Client, config: Config) -> STTProvider:
    return _STT(client, config.providers.stt.model)


def create_fallback_tts(client: httpx.Client, config: Config) -> TTSProvider | None:
    return _TTS(client, config.providers.tts.fallback) if config.providers.tts.fallback else None


def revalidate_website(settings: Settings) -> None:
    settings.require("web_revalidate_url", "revalidate_secret")
    response = httpx.post(
        settings.web_revalidate_url,
        headers={"Authorization": f"Bearer {settings.revalidate_secret.get_secret_value()}"},
        timeout=30.0,
    )
    response.raise_for_status()
