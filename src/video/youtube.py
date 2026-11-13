"""Read a YouTube video's details and official caption tracks, and download the video with yt-dlp.

The video is kept as an MP4 the browser plays: H.264 video and AAC sound, at most 720p. YouTube's
automatic captions ("es-orig", its recognition of the speech) time each word, so they time the
words of whichever captions are shown; they are shown themselves only when the learner picks them,
as they mishear more often than an official track.

Videos are read without signing in. Only a video YouTube will not show without an account, such
as an age-restricted one, is read again signed in with the cookies the settings name, so the
account is not tied to every download.
"""

import json
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from config import get_settings

_VIDEO_ID = re.compile(r"(?:v=|youtu\.be/|/shorts/|/embed/|/live/)([\w-]{11})")
_BARE_ID = re.compile(r"[\w-]{11}")
_CAPTION_FORMAT = "json3"
_VIDEO_FORMAT = "bv*[height<=720][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[height<=720][ext=mp4]/b"


class YouTubeError(RuntimeError):
    pass


@dataclass(frozen=True)
class CaptionTrack:
    # The track as YouTube lists it: es, es-419.
    code: str
    url: str


@dataclass(frozen=True)
class VideoInfo:
    id: str
    title: str
    duration_ms: int | None
    tracks: list[CaptionTrack]
    # YouTube's recognition of the speech, by spoken language: es for the es-orig track.
    speech_tracks: list[CaptionTrack]
    # Whether the video could only be read signed in, so it is downloaded signed in too.
    signed_in: bool = False


def video_id(url_or_id: str) -> str:
    value = url_or_id.strip()
    if _BARE_ID.fullmatch(value):
        return value
    match = _VIDEO_ID.search(value)
    if match is None:
        raise YouTubeError(f"not a YouTube video link: {url_or_id!r}")
    return match.group(1)


def _watch_url(identifier: str) -> str:
    return f"https://www.youtube.com/watch?v={identifier}"


def _sign_in_options() -> dict[str, Any]:
    """The cookies to sign in with, as the settings name them; empty when they name none."""
    settings = get_settings()
    options: dict[str, Any] = {}
    if settings.youtube_cookies_from_browser:
        options["cookiesfrombrowser"] = (settings.youtube_cookies_from_browser,)
    if settings.youtube_cookies_file:
        options["cookiefile"] = settings.youtube_cookies_file
    return options


def _client(options: dict[str, Any] | None = None, *, signed_in: bool = False) -> Any:
    try:
        import yt_dlp
    except ImportError as error:
        raise RuntimeError('reading YouTube needs yt-dlp: pip install -e ".[video]"') from error
    sign_in = _sign_in_options() if signed_in else {}
    return yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, **sign_in, **(options or {})})


def _needs_sign_in(error: Exception) -> bool:
    """yt-dlp asks for cookies when YouTube wants an account: age checks, bot checks."""
    message = str(error)
    return "--cookies" in message or "Sign in" in message


def _tracks(listing: dict[str, list[dict[str, Any]]]) -> list[CaptionTrack]:
    tracks = []
    for code, formats in listing.items():
        url = next((item["url"] for item in formats if item.get("ext") == _CAPTION_FORMAT), None)
        if url:
            tracks.append(CaptionTrack(code=code, url=url))
    return tracks


def _extract(identifier: str, *, signed_in: bool) -> dict[str, Any]:
    with _client({"skip_download": True}, signed_in=signed_in) as client:
        info: dict[str, Any] = client.extract_info(_watch_url(identifier), download=False)
    return info


def read_video(identifier: str) -> VideoInfo:
    signed_in = False
    try:
        info = _extract(identifier, signed_in=False)
    except Exception as error:
        if not (_needs_sign_in(error) and _sign_in_options()):
            raise
        signed_in = True
        info = _extract(identifier, signed_in=True)
    duration = info.get("duration")
    automatic = _tracks(info.get("automatic_captions") or {})
    return VideoInfo(
        id=identifier,
        title=info.get("title") or identifier,
        duration_ms=round(duration * 1000) if duration else None,
        tracks=_tracks(info.get("subtitles") or {}),
        # The other automatic codes are machine translations of the speech.
        speech_tracks=[
            CaptionTrack(code=track.code.removesuffix("-orig"), url=track.url)
            for track in automatic
            if track.code.endswith("-orig")
        ],
        signed_in=signed_in,
    )


def pick_track(info: VideoInfo, language: str) -> CaptionTrack | None:
    """The official track in exactly the language, else one in a regional variant (es-419)."""
    exact = next((track for track in info.tracks if track.code == language), None)
    return exact or next(
        (track for track in info.tracks if track.code.startswith(f"{language}-")), None
    )


def pick_speech_track(info: VideoInfo, language: str) -> CaptionTrack | None:
    return next((track for track in info.speech_tracks if track.code == language), None)


def download_track(track: CaptionTrack, *, signed_in: bool = False) -> dict[str, Any]:
    with _client(signed_in=signed_in) as client:
        data: dict[str, Any] = json.loads(client.urlopen(track.url).read())
    return data


def download_video(
    identifier: str,
    path: Path,
    on_progress: Callable[[float], None] | None = None,
    *,
    signed_in: bool = False,
) -> None:
    """Save the video as path, an .mp4; yt-dlp joins the picture and sound with ffmpeg.

    on_progress hears how much of the file being fetched has arrived: the picture, then the sound.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    def hook(status: dict[str, Any]) -> None:
        total = status.get("total_bytes") or status.get("total_bytes_estimate")
        if on_progress and status.get("status") == "downloading" and total:
            on_progress(min(1.0, status.get("downloaded_bytes", 0) / total))

    options = {
        "format": _VIDEO_FORMAT,
        "merge_output_format": "mp4",
        "outtmpl": str(path.with_suffix(".%(ext)s")),
        "progress_hooks": [hook],
    }
    with _client(options, signed_in=signed_in) as client:
        client.download([_watch_url(identifier)])
    if not path.is_file():
        raise YouTubeError(f"yt-dlp did not save {path.name}")
