# Batch script
```
cd kinlex
nohup caffeinate -is src/scripts/run_batches.sh 10 14 >/dev/null 2>&1 &
```

10 14 runs batches 10 through 14, which are rows 4501–7000 of the CSV.
caffeinate -is keeps the Mac from going to sleep while it runs.
nohup … & runs it in the background, so closing the terminal window does not stop it.

grep "===\|!!!" data/pipeline/de/logs/batches_10-14.out   # when each batch started and finished, and whether it had failures
tail -f data/pipeline/de/logs/batches_10-14.out           # follow the progress live

```
grep "===\|!!!" data/pipeline/de/logs/batches_10-14.out   # Start and end of each batch, and whether any failures occurred
tail -f data/pipeline/de/logs/batches_10-14.out           # View progress in real time
```

```
cd kinlex
nohup caffeinate -is src/scripts/run_batches.sh 15 17 >/dev/null 2>&1 &
```
15 17 runs batches 15 through 17, which are rows 7001–8500 of the CSV.

## One batch

With a single number the script runs just that batch (`15` is the same as `15 15`):
```
cd kinlex
nohup caffeinate -is src/scripts/run_batches.sh 15 >/dev/null 2>&1 &
```
Batch 15 is rows 7001–7500 of the CSV and takes about 2.3 hours. Rows already done, for example by
the smaller runs below, are skipped. The log goes to data/pipeline/de/logs/batches_15-15.out:
```
grep "===\|!!!" data/pipeline/de/logs/batches_15-15.out
tail -f data/pipeline/de/logs/batches_15-15.out
```

## A few rows at a time

`--batch` counts batches of `--batch-size` rows, so the same row has a different batch number for
each batch size. The script works out the first row as

    first row = (batch − 1) × batch size + 1

Think of it as cutting the whole CSV into pieces of that size and picking one piece:

| batch size | batch | rows |
|---|---|---|
| 500 (the default) | 15 | 7001–7500 |
| 20 | 351 | 7001–7020 |
| 30 | 235 | 7021–7050 |

To find the batch number for a run, take the rows already done, divide by the batch size, and add one.

To run only the next 20 rows of the CSV (rows 7001–7020, starting at der Elan):
```
cd kinlex/src
.venv/bin/python -m scripts.process_vocabulary prepare --batch 351 --batch-size 20
```
The first row is (batch − 1) × batch size + 1, so batch 351 of 20 rows starts at row 7001.
It does the same as a full batch (fields, audio and review files, here german_enriched_batch_0351) and takes about 5–8 minutes.
A later full batch skips these rows, since their fields already exist (unless run with --force).

Another example: the 30 rows right after those, rows 7021–7050:
```
cd kinlex/src
.venv/bin/python -m scripts.process_vocabulary prepare --batch 235 --batch-size 30
```
Rows 7001–7020 are done, so the run starts after row 7020: 7020 ÷ 30 = 234, plus one makes batch 235,
and (235 − 1) × 30 + 1 = 7021. The start must fall on a whole batch, so pick a batch size that divides
the number of rows already done (7020 here: 10, 20, 30, 60 and so on, but not 50 or 100).

To see which words those are (the CSV's first line is the header, so rows 7001–7020 are lines 7002–7021):
```
sed -n '7002,7021p' data/vocabulary/german/german.csv | cut -d, -f1
```
