"""Environment variables (.env) and pipeline configuration (config.yaml)."""

import os
from functools import cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

import yaml
from pydantic import BaseModel, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PIPELINE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PIPELINE_ROOT.parent


class SettingsError(RuntimeError):
    pass


class Settings(BaseSettings):
    """Secrets and connection strings. Each step calls `require` for the values it needs, so
    offline steps run without model or database credentials."""

    model_config = SettingsConfigDict(env_file=PIPELINE_ROOT / ".env", extra="ignore")

    scads_api_url: str = ""
    scads_api_key: SecretStr = SecretStr("")
    database_url: SecretStr = SecretStr("")
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: SecretStr = SecretStr("")
    r2_bucket: str = ""
    web_revalidate_url: str = ""
    revalidate_secret: SecretStr = SecretStr("")
    # Signed-in YouTube cookies, for videos that need an account (age-restricted ones): a browser
    # to read them from (chrome, firefox, safari, edge, brave), or a cookies.txt file.
    youtube_cookies_from_browser: str = ""
    youtube_cookies_file: str = ""

    def require(self, *names: str) -> None:
        missing = [name.upper() for name in names if not _is_set(getattr(self, name))]
        if missing:
            raise SettingsError(f"Missing required settings in pipeline/.env: {', '.join(missing)}")

    @property
    def r2_enabled(self) -> bool:
        return all(
            _is_set(value)
            for value in (
                self.r2_account_id,
                self.r2_access_key_id,
                self.r2_secret_access_key,
                self.r2_bucket,
            )
        )

    @property
    def r2_endpoint(self) -> str:
        value = self.r2_account_id.strip().rstrip("/")
        if value.startswith(("https://", "http://")):
            return value
        return f"https://{value}.r2.cloudflarestorage.com"

    @property
    def revalidation_enabled(self) -> bool:
        return _is_set(self.web_revalidate_url) and _is_set(self.revalidate_secret)


def _is_set(value: str | SecretStr) -> bool:
    raw = value.get_secret_value() if isinstance(value, SecretStr) else value
    return bool(raw.strip())


class LLMConfig(BaseModel):
    model: str
    rate_limits: dict[str, int] = Field(default_factory=dict)
    # Reasoning models otherwise spend most of each call thinking (~4k tokens, ~100 s).
    reasoning_effort: Literal["low", "medium", "high"] | None = None


class TTSConfig(BaseModel):
    provider: Literal["omnivoice", "openai"]
    model: str
    fallback: str | None = None
    fallback_voice: str | None = None
    voices: dict[str, str]
    instructions: dict[str, str] = Field(default_factory=dict)


class STTConfig(BaseModel):
    model: str


class ProvidersConfig(BaseModel):
    llm: LLMConfig
    tts: TTSConfig
    stt: STTConfig


class Config(BaseModel):
    language: str
    providers: ProvidersConfig
    llm_concurrency: int
    tts_concurrency: int
    retries: int


PRODUCTION_ENV_FILE = PIPELINE_ROOT / ".env.production"


def is_production() -> bool:
    return os.environ.get("KINLEX_TARGET", "local") == "production"


# The pipeline works on the local Supabase unless KINLEX_TARGET=production, which adds the values
# in .env.production (the production database and website) on top of .env.
@cache
def get_settings() -> Settings:
    target = os.environ.get("KINLEX_TARGET", "local")
    if target == "local":
        return Settings()
    if target != "production":
        raise SettingsError(f"KINLEX_TARGET must be local or production, not {target!r}")
    if not PRODUCTION_ENV_FILE.is_file():
        raise SettingsError(f"KINLEX_TARGET=production needs {PRODUCTION_ENV_FILE}")
    return Settings(_env_file=(PIPELINE_ROOT / ".env", PRODUCTION_ENV_FILE))


def database_host(settings: Settings) -> str:
    """The database host, to say where the pipeline writes without showing the password."""
    return urlsplit(settings.database_url.get_secret_value()).hostname or "unknown host"


@cache
def get_config() -> Config:
    with (PIPELINE_ROOT / "config.yaml").open(encoding="utf-8") as file:
        return Config.model_validate(yaml.safe_load(file))
