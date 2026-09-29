#!/bin/sh
# Local stack only (npx supabase start). The local realtime server runs in region "local" (no REGION setting), but it
# registers its built-in tenant "realtime-dev" in "us-east-1". Every 10 minutes it sees no server in the tenant's
# region and "rebalances": the tenant's database stream stops for ~6 seconds ("Rebalancing Tenant database
# connection for a closer region"). Live messages sent then are lost while phones stay connected, so a phone never
# refetches (found in the M4 proof: a clock-out never reached the owner's board).
#
# The Supabase CLI has no setting for the realtime region, so this re-creates the realtime container with exactly
# its own settings plus REGION=us-east-1 (the tenant's region). Nothing else changes; `supabase stop` / `start`
# remove it and create the original again, and the e2e setup (e2e/support/global-setup.ts) runs this before each run.
set -e
PROJECT=$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)
NAME="supabase_realtime_$PROJECT"
REGION=us-east-1

if docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$NAME" | grep -qx "REGION=$REGION"; then
  exit 0
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
# The container's own settings (they include local-only secrets, so they stay in a private temp file).
docker inspect "$NAME" > "$WORK/inspect.json"
python3 - "$WORK" "$REGION" <<'PY'
import json, shlex, sys
work, region = sys.argv[1], sys.argv[2]
c = json.load(open(f"{work}/inspect.json"))[0]
cfg, host = c["Config"], c["HostConfig"]
with open(f"{work}/env", "w") as f:
    for e in cfg["Env"]:
        if not e.startswith("REGION="):
            f.write(e + "\n")
    f.write(f"REGION={region}\n")
args = ["docker", "run", "-d", "--name", c["Name"].lstrip("/"), "--env-file", f"{work}/env",
        "--restart", host["RestartPolicy"]["Name"] or "no", "--workdir", cfg["WorkingDir"] or "/"]
for k, v in (cfg.get("Labels") or {}).items():
    args += ["--label", f"{k}={v}"]
(net, conf), = c["NetworkSettings"]["Networks"].items()
args += ["--network", net]
for alias in conf.get("Aliases") or []:
    args += ["--network-alias", alias]
hc = cfg.get("Healthcheck")
if hc and hc.get("Test"):
    args += ["--health-cmd", hc["Test"][1] if hc["Test"][0] == "CMD-SHELL" else " ".join(hc["Test"][1:]),
             "--health-interval", f"{hc.get('Interval', 10**10) // 10**9}s",
             "--health-timeout", f"{hc.get('Timeout', 2 * 10**9) // 10**9}s",
             "--health-retries", str(hc.get("Retries", 3))]
entry = cfg.get("Entrypoint") or []
if entry:
    args += ["--entrypoint", entry[0]]
args += [cfg["Image"], *entry[1:], *(cfg.get("Cmd") or [])]
open(f"{work}/run.sh", "w").write(" ".join(shlex.quote(a) for a in args) + "\n")
PY
docker rm -f "$NAME" >/dev/null
sh "$WORK/run.sh" >/dev/null
i=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$NAME")" = "healthy" ] || [ $i -ge 120 ]; do
  i=$((i + 1))
  sleep 1
done
echo "realtime: region set to $REGION ($(docker inspect -f '{{.State.Health.Status}}' "$NAME"))"
