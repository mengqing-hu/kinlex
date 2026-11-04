"""Generate a side-by-side German pronunciation comparison for two TTS models."""

import argparse
import csv
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from config import REPO_ROOT, get_config, get_settings
from services.clients import TTSProvider, Voice, create_fallback_tts, create_tts, model_client

DEFAULT_INPUT = REPO_ROOT / "data" / "vocabulary" / "german" / "german.csv"
DEFAULT_OUTPUT = REPO_ROOT / "data" / "output" / "de" / "tts_comparison"
OMNIVOICE_INSTRUCTIONS = (
    "Native Standard German (Hochdeutsch), precise dictionary pronunciation, "
    "natural word stress, no foreign accent, moderate speed."
)


@dataclass(frozen=True)
class Sample:
    word: str
    focus: str


SAMPLES = (
    Sample("sprechen", "initial sp and ich-Laut"),
    Sample("richtig", "final -ig as ich-Laut"),
    Sample("fünf", "front rounded vowel ü"),
    Sample("zwölf", "front rounded vowel ö"),
    Sample("frühstücken", "r, ü, st, and consonant cluster"),
    Sample("plötzlich", "ö, z as /ts/, and final ich-Laut"),
    Sample("das Mädchen", "ä and diminutive -chen"),
    Sample("das Buch", "ach-Laut after u"),
    Sample("die Küche", "ü and ich-Laut"),
    Sample("die Straße", "long a and ß"),
    Sample("die Zeitung", "z as /ts/ and ei diphthong"),
    Sample("das Pferd", "initial pf and German r"),
    Sample("das Brötchen", "ö and diminutive -chen"),
    Sample("das Wörterbuch", "compound stress, ö, and ach-Laut"),
    Sample("die Sehenswürdigkeit", "long compound stress and ü"),
    Sample("die Entschuldigung", "tsch cluster and -ung ending"),
    Sample("die Psychologie", "Greek loanword and stress"),
    Sample("die Chemie", "standard German initial ich-Laut"),
    Sample("das Restaurant", "French loanword pronunciation"),
    Sample("die Universität", "multi-syllable stress and ä"),
)


def _slug(value: str) -> str:
    replacements = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
    return re.sub(r"[^a-z0-9]+", "_", value.casefold().translate(replacements)).strip("_")


def _source_rows(path: Path) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        return {row["word"].strip(): row for row in csv.DictReader(file)}


def _write_index(records: list[dict[str, object]], output_dir: Path) -> None:
    rows = []
    for record in records:
        number = html.escape(str(record["number"]))
        word = html.escape(str(record["word"]))
        example = html.escape(str(record["example_sentence"]))
        focus = html.escape(str(record["focus"]))
        omni_word = html.escape(str(record["omnivoice_word"]))
        omni_example = html.escape(str(record["omnivoice_example"]))
        hd_word = html.escape(str(record["tts_1_hd_word"]))
        hd_example = html.escape(str(record["tts_1_hd_example"]))
        rows.append(
            f"""
            <tr>
              <td>{number}</td><td><strong>{word}</strong><br><small>{focus}</small></td>
              <td>{example}</td>
              <td>
                <label>Word<audio controls preload="none" src="{omni_word}"></audio></label>
                <label>Example
                  <audio controls preload="none" src="{omni_example}"></audio></label>
              </td>
              <td>
                <label>Word<audio controls preload="none" src="{hd_word}"></audio></label>
                <label>Example
                  <audio controls preload="none" src="{hd_example}"></audio></label>
              </td>
            </tr>
            """
        )
    document = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>German TTS comparison</title>
  <style>
    body {{ font: 15px system-ui, sans-serif; margin: 2rem; color: #1f2937; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #d1d5db; padding: .75rem; text-align: left; vertical-align: top; }}
    th {{ background: #f3f4f6; position: sticky; top: 0; }}
    small {{ color: #6b7280; }}
    label {{ display: block; font-size: 12px; margin-bottom: .5rem; }}
    audio {{ display: block; height: 32px; margin-top: .2rem; width: 250px; }}
  </style>
</head>
<body>
  <h1>German TTS comparison</h1>
  <p>Compare the same 20 words and example sentences using OmniVoice and tts-1-hd.</p>
  <table>
    <thead>
      <tr><th>#</th><th>Word and focus</th><th>Example</th><th>OmniVoice</th><th>tts-1-hd</th></tr>
    </thead>
    <tbody>{"".join(rows)}</tbody>
  </table>
</body>
</html>
"""
    (output_dir / "index.html").write_text(document, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    config = get_config()
    rows = _source_rows(args.input)
    missing = [sample.word for sample in SAMPLES if sample.word not in rows]
    if missing:
        raise ValueError(f"samples missing from CSV: {', '.join(missing)}")

    args.output.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    tasks: list[tuple[str, str, Path, TTSProvider, Voice]] = []
    with model_client(get_settings()) as client:
        omnivoice = create_tts(client, config)
        fallback = create_fallback_tts(client, config)
        if fallback is None:
            raise ValueError("providers.tts.fallback is not configured")
        primary_voice = Voice(
            config.providers.tts.voices["de"],
            OMNIVOICE_INSTRUCTIONS,
        )
        fallback_voice = Voice(
            config.providers.tts.fallback_voice or config.providers.tts.voices["de"]
        )

        for number, sample in enumerate(SAMPLES, start=1):
            row = rows[sample.word]
            stem = f"{number:02d}_{_slug(sample.word)}"
            paths: dict[str, str] = {}
            for model_key, provider, voice in (
                ("omnivoice", omnivoice, primary_voice),
                ("tts_1_hd", fallback, fallback_voice),
            ):
                model_dir = args.output / model_key
                model_dir.mkdir(exist_ok=True)
                for content_key, text in (
                    ("word", sample.word),
                    ("example", row["example_sentence"]),
                ):
                    path = model_dir / f"{stem}_{content_key}.mp3"
                    paths[f"{model_key}_{content_key}"] = path.relative_to(args.output).as_posix()
                    if args.force or not path.exists():
                        tasks.append((model_key, text, path, provider, voice))
            records.append(
                {
                    "number": number,
                    "word": sample.word,
                    "example_sentence": row["example_sentence"],
                    "sentence_meaning": row["sentence_meaning"],
                    "focus": sample.focus,
                    **paths,
                }
            )

        def generate(task: tuple[str, str, Path, TTSProvider, Voice]) -> None:
            model_key, text, path, provider, voice = task
            content = provider.synthesize(text, voice)
            if not content:
                raise RuntimeError(f"{model_key} returned empty audio for {text}")
            path.write_bytes(content)
            print(f"generated {model_key}: {text}")

        with ThreadPoolExecutor(max_workers=config.tts_concurrency) as pool:
            list(pool.map(generate, tasks))

    (args.output / "manifest.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _write_index(records, args.output)
    print(f"comparison page: {args.output / 'index.html'}")
    print(f"audio files: {len(records) * 4}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
