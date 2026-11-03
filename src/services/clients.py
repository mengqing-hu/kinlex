"""OpenAI-compatible LLM and TTS clients."""

import threading
import time
from dataclasses import dataclass
from typing import Protocol

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


class LLMProvider(Protocol):
    def complete(self, model: str, system: str, prompt: str) -> str: ...


class TTSProvider(Protocol):
    model: str

    def synthesize(self, text: str, voice: Voice) -> bytes: ...


_RETRYABLE = {408, 409, 429, 500, 502, 503, 504}


def _post(client: httpx.Client, path: str, **kwargs: object) -> httpx.Response:
    for attempt in range(1, 7):
        try:
            response = client.post(path, **kwargs)  # type: ignore[arg-type]
        except httpx.TransportError as error:
            if attempt == 6:
                raise ProviderError(f"POST {path} failed: {error}") from error
            time.sleep(2**attempt)
            continue
        if response.status_code not in _RETRYABLE or attempt == 6:
            if response.is_error:
                raise ProviderError(
                    f"POST {path} returned {response.status_code}: {response.text[:300]}"
                )
            return response
        retry_after = response.headers.get("retry-after", "")
        time.sleep(max(2**attempt, int(retry_after) if retry_after.isdigit() else 0))
    raise AssertionError("unreachable")


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

    def complete(self, model: str, system: str, prompt: str) -> str:
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
                "temperature": 0.2,
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
