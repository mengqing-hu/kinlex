"""Audio storage: Cloudflare R2 when configured, otherwise web/public/audio-samples for local
development. Either way the returned path is relative to NEXT_PUBLIC_AUDIO_BASE_URL."""

import hashlib
import tempfile
from pathlib import Path
from typing import Any

import boto3

from config import REPO_ROOT, Settings

LOCAL_AUDIO_ROOT = REPO_ROOT / "web" / "public" / "audio-samples"


class AudioStorage:
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.r2_bucket
        self._client: Any = None
        if settings.r2_enabled:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.r2_endpoint,
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key.get_secret_value(),
                region_name="auto",
            )

    @property
    def target(self) -> str:
        return f"R2 bucket {self._bucket}" if self._client else str(LOCAL_AUDIO_ROOT)

    def upload(self, data: bytes, language: str, owner_type: str) -> str:
        """Store under a content hash, so a changed clip never reuses a CDN-cached URL."""
        key = f"{language}/{owner_type}/{hashlib.sha256(data).hexdigest()[:24]}.mp3"
        if self._client is not None:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType="audio/mpeg",
                CacheControl="public, max-age=31536000, immutable",
            )
        else:
            destination = LOCAL_AUDIO_ROOT / key
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as file:
                file.write(data)
                temporary = Path(file.name)
            temporary.replace(destination)
        return key
