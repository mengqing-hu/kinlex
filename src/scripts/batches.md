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
