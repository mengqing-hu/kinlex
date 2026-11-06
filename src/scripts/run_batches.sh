#!/usr/bin/env bash
# Prepares several vocabulary batches one after another, for a long unattended run:
#
#     src/scripts/run_batches.sh 10 14
#
# Each batch gets its database fields, its audio and its review files (`prepare`), then a list of
# segmentations worth a look. A batch with failures is noted in the log and the next one still
# runs; its failed words can be retried later with `prepare --batch N`. Everything goes to
# data/pipeline/de/logs/batches_<first>-<last>.out.

set -u

# Python refuses to start when stdin is gone, which happens once the terminal that launched a
# background run is closed.
exec </dev/null

first=${1:?usage: run_batches.sh FIRST [LAST]}
last=${2:-$first}

cd "$(dirname "$0")/.."
log="../data/pipeline/de/logs/batches_${first}-${last}.out"

for batch in $(seq "$first" "$last"); do
  echo "=== batch $batch start $(date) ==="
  if ! .venv/bin/python -m scripts.process_vocabulary prepare --batch "$batch"; then
    echo "!!! batch $batch had failures"
  fi
  .venv/bin/python -m scripts.check_morphology \
    --output "../data/output/de/morphology_issues_batch_$(printf '%04d' "$batch").md"
  echo "=== batch $batch done $(date) ==="
done 2>&1 | tee -a "$log"
