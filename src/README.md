# Kinlex content pipeline

The canonical input is `data/vocabulary/german/german.csv`. It contains exactly these source
fields:

```text
word,word_class,word_meaning,example_sentence,sentence_meaning,level
```

The source CSV remains unchanged. The pipeline imports those fields into PostgreSQL and uses the
LLM only for fields that are missing from the source: `gender`, `plural`, and the morpheme
structure. IDs, slugs, source metadata, status, and table relationships are generated
deterministically by the application. `freq_rank` stays empty because a language model is not a
reliable frequency source.

TTS is a separate operation. It generates audio for both words and example sentences. MP3 files
are uploaded to R2 when configured; otherwise they are written to:

```text
web/public/audio-samples/de/word/
web/public/audio-samples/de/example/
```

The `audio` database table stores the corresponding relative path, voice, model, accent, and owner.
LLM responses are cached under `data/pipeline/de/cache/`, and run logs are stored under
`data/pipeline/de/logs/`. The database remains the authoritative generated result; exported files
are review snapshots and are never used as pipeline input.

## Setup

Run everything from `src/`. Install the package with its development tools:

```bash
cd src
pip install -e ".[dev]"
```

Copy `.env.example` to `.env` and fill in what the steps you run need: `DATABASE_URL` for every
database step, `SCADS_API_URL` and `SCADS_API_KEY` for the LLM, the `R2_*` values to upload audio
to R2, and `WEB_REVALIDATE_URL` with `REVALIDATE_SECRET` to refresh the website after publishing.
Models, voices, concurrency, and retries are set in `config.yaml`.

## Commands

The installed command and the module are the same program:

```bash
kinlex-pipeline <command> [options]
python -m scripts.process_vocabulary <command> [options]
```

| Command       | What it does                                                                     |
| ------------- | -------------------------------------------------------------------------------- |
| `import`      | Imports CSV rows as draft words and examples. Calls no model.                    |
| `fields`      | Imports the CSV, calls the LLM for missing fields, then exports review files.    |
| `audio`       | Imports the CSV if needed and calls TTS for missing word and example audio.      |
| `export`      | Recreates the review CSV and JSON from the database. Calls no model.             |
| `publish`     | Makes an imported batch visible to the public website.                           |
| `run`         | `fields`, then `audio`, then exports review files.                               |
| `prepare`     | Same as `run`, for one batch you review before publishing.                       |
| `process`     | `prepare`, then `publish`, unless any word or audio failed.                      |
| `consistency` | Reapplies the lexicon to every stored segmentation and expands nested roots.     |
| `annotate`    | Splits example sentences into words with their meaning there, for hover on the site. |
| `translate`   | Translates English word, sentence and word part meanings into another language.  |

Options:

- `--batch N` selects the N-th block of `--batch-size` rows (default 500), one-based. It also names
  the review files `german_enriched_batch_000N.csv` and `.json`.
- `--limit N` processes the first N rows instead; it cannot be combined with `--batch`. Without
  either, the whole CSV is processed and the files are named `german_enriched.csv` and `.json`.
- `--force` regenerates fields or audio that already exist.
- `--dry-run` (`consistency` only) prints the changes without saving them.
- `--lexicon-only` (`annotate` only) stores the words and the meanings the vocabulary settles,
  without calling the LLM.
- `--meaning-language CODE` (`translate` and `annotate`) is the language words are explained in,
  such as `zh`; it defaults to `en`.
- `--input PATH`, `--language CODE`, and `--output-dir PATH` override the defaults.

Generation is idempotent. Without `--force`, completed rows are skipped and failed rows remain
eligible for the next run. With `--force`, cached LLM responses are reused as long as the prompt
is unchanged, so a forced rerun only calls the model for words it has not answered before.

## Example annotations

`annotate` needs spaCy and its German model, which are an optional extra:

```bash
pip install -e ".[annotate]"
kinlex-pipeline annotate --lexicon-only   # words and vocabulary meanings, no model calls
kinlex-pipeline annotate                  # then the LLM fills in the remaining meanings
```

spaCy finds each word's dictionary form and joins a separated verb prefix to its verb ("hast ...
vor" is vorhaben). A word whose vocabulary entry has a single meaning takes it directly; the LLM is
asked, 20 sentences per call, only for words whose entry lists several meanings ("from, of") and
words that are not in the vocabulary, such as articles. The command is idempotent: it tokenizes
only examples without tokens and asks only for meanings still missing, so rerunning it retries
failed batches. `--limit N` counts examples; `--force` tokenizes every example again.

## Other meaning languages

The website explains words in the language a learner uses it in, and shows English wherever that
language has no meaning yet. English comes from the CSV; every other language is translated from
it, then annotated:

```bash
kinlex-pipeline translate --meaning-language zh   # word meanings, sentences, word parts
kinlex-pipeline annotate --meaning-language zh    # hover meanings in the example sentences
```

`translate` asks the LLM in batches (40 words, 25 sentences or 50 word parts per call) for what the
language is still missing, and again for a word part whose English meaning changed since. Run it
first: `annotate` takes a word's translated meaning when it has only one and the English pass was
certain of the word, and asks the LLM for the rest with the translated sentence beside it.
`--limit N` applies to each of the three parts of `translate`; `--force` translates everything again.

## Batch workflow

```bash
python -u -m scripts.process_vocabulary prepare --batch 2
python -m scripts.check_morphology --output ../data/output/de/morphology_issues_batch_0002.md
# review the files in data/output/de/, fix the lexicon (see below), then:
python -m scripts.process_vocabulary consistency
python -m scripts.process_vocabulary export --batch 2
python -m scripts.process_vocabulary publish --batch 2
```

`process --batch 2` runs the generation and publishing steps in one go when no review is needed.

Imported words and examples stay in `draft` status until `publish`. The public Supabase policies
expose only `published` content, so draft rows do not appear on the website. `publish` calls no
model.

The review CSV stores the full morpheme array in `morphemes_json` for spreadsheet review; the JSON
keeps the nested structure for another model. Both include `generation_model`, `review_status`,
and an empty `review_notes` field. Editing these files does not update the database; fixes go into
the lexicon instead.

## Morphology

The LLM segments one word at a time with `prompts/word_enrichment_v2.md`. Because it cannot see
other words, its output passes through deterministic steps before it is saved:

1. **Hand-checked fixes.** An entry listed under `overrides` in `lexicon/de_roots.json` uses that
   segmentation instead of the model's. The parts must spell the entry's stem, or the run fails.
2. **Type normalization** (`utils/affixes.py`). The affix dictionary decides what is an affix: a
   prefix it does not list becomes a root (`groß-` in Großmutter becomes `groß`), a verb part
   spelled like a listed prefix becomes that prefix (`weg` in weggehen becomes `weg-`), and an
   unlisted single letter is an abbreviation with no morpheme (the U in U-Bahn).
3. **Affix meanings.** Prefixes and suffixes take their meaning from `lexicon/de_affixes.json`, so
   one meaning is shared by every word that uses the affix.
4. **Root consistency** (`core/consistency.py`), across the whole vocabulary. A root that is itself
   a segmented word takes that word's segmentation: Hauptbahnhof becomes Haupt + Bahn + Hof, and
   the "Bad" in Badezimmer takes das Bad's root `baden`.

`fields` and every command that includes it run step 4 after generating. `consistency` runs all
four steps on what is already stored, so lexicon edits reach earlier batches without calling the
model.

`scripts/check_morphology.py` writes a review report of likely problems, such as words without a
segmentation, the same text used as a root and as an affix, roots that still name another word,
lowercase noun roots, and affixes missing from the dictionary. Every check is a heuristic.

### Lexicon files

`lexicon/de_affixes.json`:

- `prefix`, `suffix`: the curated affixes and their shared meanings.
- `root_homographs`: roots spelled like an affix but unrelated to it, such as `Ei` and `-ei`. The
  report does not flag them.

`lexicon/de_roots.json`:

- `overrides`: the full segmentation of an entry's stem, keyed by the entry as written in the CSV.
  Untyped parts such as linking letters are written as `{"word_part": "en"}`.
- `lowercase_roots`: roots that stay lowercase although a noun has the same letters, such as
  `deutsch` for Deutsch and Deutschland. The report does not flag them.

Changing the prompt changes the cache key, so the next `--force` run calls the model again for
every word. Prefer a lexicon fix plus `consistency` for words that are already generated.

## Structure

```text
cli.py                              installed command wrapper
config.py, config.yaml              settings, secrets, and model configuration
scripts/process_vocabulary.py       command-line entry point for all commands
scripts/check_morphology.py         morphology review report
scripts/compare_tts.py              side-by-side TTS voice comparison page
core/pipeline.py                    field generation, post-processing, TTS, export, publish
core/consistency.py                 root consistency across the vocabulary
core/models.py                      typed data contracts
services/db.py                      database import and persistence
services/clients.py                 LLM and TTS clients
services/storage.py                 local and R2 audio storage
utils/affixes.py                    affix dictionary and type normalization
utils/roots.py                      hand-checked root overrides
utils/review_export.py              review CSV and JSON export
utils/vocabulary.py                 strict CSV reader
utils/runtime.py                    cache, logging, and summaries
lexicon/de_affixes.json             curated prefixes, suffixes, and root homographs
lexicon/de_roots.json               root overrides and lowercase roots
prompts/word_enrichment_v2.md       LLM output contract (v1 is kept for its cached responses)
```

## Checks

```bash
ruff check .
ruff format --check .
mypy
```
