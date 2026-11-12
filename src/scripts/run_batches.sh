#!/usr/bin/env bash
# Prepares several vocabulary batches one after another, for a long unattended run:
#
#     src/scripts/run_batches.sh 10 14
#     src/scripts/run_batches.sh 1 21 es --force
#     src/scripts/run_batches.sh 1 19 pt
#     KINLEX_COMMAND=audio src/scripts/run_batches.sh 1 21 es
#
# The optional third argument is the language (de by default); anything after it is passed on to
# the pipeline. A German batch gets its database fields, its audio and its review files
# (`prepare`). A Spanish or Portuguese batch gets its fields and review files only (`fields`),
# since audio follows once every word is segmented. KINLEX_COMMAND picks another pipeline command,
# such as audio for the Spanish audio. Each batch whose words were segmented then gets a list of
# segmentations worth a look.
# A batch with failures is noted in the log and the next one still runs; its failed words can be
# retried by running the same batch again. Everything goes to
# data/pipeline/<language>/logs/batches_<first>-<last>.out (audio_batches_… with KINLEX_COMMAND=audio).

set -u

# Python refuses to start when stdin is gone, which happens once the terminal that launched a
# background run is closed.
exec </dev/null

first=${1:?usage: run_batches.sh FIRST [LAST] [LANGUAGE] [PIPELINE OPTIONS...]}
last=${2:-$first}
language=${3:-de}
shift $(($# < 3 ? $# : 3))

case "$language" in
  de) command=prepare; vocabulary=german ;;
  es) command=fields; vocabulary=spanish ;;
  pt) command=fields; vocabulary=portuguese ;;
  *) echo "unknown language: $language" >&2; exit 2 ;;
esac
command=${KINLEX_COMMAND:-$command}

cd "$(dirname "$0")/.."
mkdir -p "../data/pipeline/$language/logs"
log="../data/pipeline/$language/logs/${KINLEX_COMMAND:+${KINLEX_COMMAND}_}batches_${first}-${last}.out"

for batch in $(seq "$first" "$last"); do
  echo "=== batch $batch start $(date) ==="
  if ! .venv/bin/python -m scripts.process_vocabulary "$command" --batch "$batch" \
    --language "$language" \
    --input "../data/vocabulary/$vocabulary/$vocabulary.csv" \
    --output-dir "../data/output/$language" \
    "$@"; then
    echo "!!! batch $batch had failures"
  fi
  if [ "$command" != audio ]; then
    .venv/bin/python -m scripts.check_morphology --language "$language" \
      --output "../data/output/$language/morphology_issues_batch_$(printf '%04d' "$batch").md"
  fi
  echo "=== batch $batch done $(date) ==="
done 2>&1 | tee -a "$log"
