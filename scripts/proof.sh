#!/bin/bash
# The proof: 3 full e2e runs in a row, then the button sweep, each run started on a quiet Mac. A run counts only if
# every test passes. An attempt that fails while the Mac was overloaded by other work (sign-in or server timeouts
# under high load) is recorded as discarded and restarted after the next quiet period; any other failure stops for
# investigation. A run during which the Mac slept (e.g. the battery ran out) or the disk filled up (video exports and
# other work; the dev server crashes with ENOSPC) is likewise discarded. Runs start only on mains power with at least
# 5 GB of free disk (a run needs about 2 GB). Logs and the summary go to $PROOF_DIR (default: /tmp/salon-proof).
#   sh scripts/proof.sh
# The Mac is kept awake only while tests run (caffeinate around each run); while waiting for mains power or a quiet
# Mac it may sleep, so an unplugged Mac is never held awake until its battery runs flat.
# Overload signs: sign-in or gateway timeouts, and a server function that times out (route.fetch) — each only counts
# when the 5-minute load went above 12 during the run.
S=${PROOF_DIR:-/tmp/salon-proof}
mkdir -p "$S"
cd "$(dirname "$0")/.." || exit 1
load1() { sysctl -n vm.loadavg | awk '{print $2}'; }
load5() { sysctl -n vm.loadavg | awk '{print $3}'; }
on_ac() { pmset -g batt | grep -q "AC Power"; }
free_gb() { df -g /System/Volumes/Data | awk 'NR==2 {print $4}'; }
# Sleep events (system sleep, including a flat battery) logged since the given "YYYY-MM-DD HH:MM:SS".
slept_since() { pmset -g log | awk -v from="$1" 'substr($0,1,19) >= from && / Sleep  /' | wc -l | tr -d ' '; }
wait_quiet() {
  echo "$(date +%H:%M) waiting for a quiet Mac on mains power with 5 GB free (load under 12 for 3 minutes; free now $(free_gb) GB)" >> "$S/proof-status.txt"
  local ok=0
  while [ $ok -lt 6 ]; do
    if on_ac && [ "$(free_gb)" -ge 5 ] && awk -v a="$(load1)" -v b="$(load5)" 'BEGIN{exit !(a < 16 && b < 12)}'; then ok=$((ok+1)); else ok=0; fi
    sleep 30
  done
  echo "$(date +%H:%M) quiet; starting" >> "$S/proof-status.txt"
}
: > "$S/final-summary.txt"
: > "$S/proof-status.txt"
attempt=0
while [ $attempt -lt 5 ]; do
  attempt=$((attempt+1))
  wait_quiet
  npx supabase db reset > /dev/null 2>&1
  docker start supabase_edge_runtime_salon-app > /dev/null 2>&1
  date -u +%Y-%m-%dT%H:%M:%S > "$S/final-start.txt"
  for i in 1 2 3; do
    [ $i -gt 1 ] && wait_quiet
    ( maxl=0; while true; do l=$(load5); awk -v l="$l" -v m="$maxl" 'BEGIN{exit !(l > m)}' && maxl=$l && echo $maxl > "$S/maxload"; sleep 30; done ) &
    watcher=$!
    echo 0 > "$S/maxload"
    run_start=$(date "+%Y-%m-%d %H:%M:%S")
    E2E_WORKERS=2 caffeinate -ims npx playwright test --grep-invert @sweep --reporter=line > "$S/final-a${attempt}-run$i.log" 2>&1
    kill $watcher 2>/dev/null
    res=$(grep -E '^\s+[0-9]+ (passed|failed|flaky|skipped)' "$S/final-a${attempt}-run$i.log" | tr -s ' ' | tr '\n' ' ')
    timeouts=$(grep -cE "504 POST|AuthRetryableFetchError|Gateway Timeout|server_busy|route.fetch: Timeout" "$S/final-a${attempt}-run$i.log")
    echo "attempt $attempt run $i: $res (peak 5-min load $(cat "$S/maxload"), sign-in timeouts $timeouts)" >> "$S/final-summary.txt"
    slept=$(slept_since "$run_start")
    if grep -q " failed" "$S/final-a${attempt}-run$i.log"; then
      if grep -q "ENOSPC" "$S/final-a${attempt}-run$i.log"; then
        echo "attempt $attempt discarded: the disk filled up during the run (free now $(free_gb) GB)" >> "$S/final-summary.txt"
        continue 2
      fi
      if [ "$slept" -gt 0 ]; then
        echo "attempt $attempt discarded: the Mac went to sleep during the run ($slept sleep events)" >> "$S/final-summary.txt"
        continue 2
      fi
      if [ "$timeouts" -gt 0 ] && awk -v m="$(cat "$S/maxload")" 'BEGIN{exit !(m > 12)}'; then
        echo "attempt $attempt discarded: the Mac was overloaded by other work" >> "$S/final-summary.txt"
        continue 2
      fi
      echo "STOPPED: a failure that is not overload — needs investigation" >> "$S/final-summary.txt"
      exit 1
    fi
  done
  echo "3 runs in a row passed (attempt $attempt). Realtime rebalancing lines during the runs: $(docker logs --since "$(cat "$S/final-start.txt")" supabase_realtime_salon-app 2>&1 | grep -cE 'Rebalancing|Zero region')" >> "$S/final-summary.txt"
  # The button sweep, on the same terms: a sweep spoiled by sleep, a full disk or overload is run again (up to 3 times).
  sweeps=0
  while [ $sweeps -lt 3 ]; do
    sweeps=$((sweeps+1))
    wait_quiet
    sweep_start=$(date "+%Y-%m-%d %H:%M:%S")
    E2E_WORKERS=2 caffeinate -ims npx playwright test --grep @sweep --reporter=line > "$S/final-sweep.log" 2>&1
    echo "sweep: $(grep -E '^\s+[0-9]+ (passed|failed)' "$S/final-sweep.log" | tr -s ' ' | tr '\n' ' ')" >> "$S/final-summary.txt"
    grep -q " failed" "$S/final-sweep.log" || { echo DONE >> "$S/final-summary.txt"; exit 0; }
    slept=$(slept_since "$sweep_start")
    timeouts=$(grep -cE "504 POST|AuthRetryableFetchError|Gateway Timeout|server_busy|route.fetch: Timeout" "$S/final-sweep.log")
    if grep -q "ENOSPC" "$S/final-sweep.log"; then
      echo "sweep discarded: the disk filled up" >> "$S/final-summary.txt"
    elif [ "$slept" -gt 0 ]; then
      echo "sweep discarded: the Mac went to sleep during it ($slept sleep events)" >> "$S/final-summary.txt"
    elif [ "$timeouts" -gt 0 ] && [ "$(awk -v l="$(load5)" 'BEGIN{print (l > 12)}')" = 1 ]; then
      echo "sweep discarded: the Mac was overloaded by other work" >> "$S/final-summary.txt"
    else
      echo "STOPPED: the sweep failed and not from sleep, disk or overload — needs investigation" >> "$S/final-summary.txt"
      exit 1
    fi
  done
  echo "GAVE UP: 3 sweeps spoiled by sleep, disk or overload" >> "$S/final-summary.txt"
  exit 1
done
echo "GAVE UP after 5 attempts" >> "$S/final-summary.txt"
