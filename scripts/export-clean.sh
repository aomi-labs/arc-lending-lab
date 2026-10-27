#!/usr/bin/env bash
# Builds a clean, publishable copy of Arc Lending Lab in export/arc-lending-lab plus a .tar.gz (override with EXPORT_DIR)
# Excludes credentials (.env*), Circle recovery files (.circle), private logs, dependencies and build output.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${EXPORT_DIR:-export/arc-lending-lab}"
rm -rf "$DEST"
mkdir -p "$DEST"
tar \
  --exclude='./export' \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.git' \
  --exclude='./export' \
  --exclude='./.agents' \
  --exclude='./.circle' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='*/recovery_file*' \
  --exclude='./traces.jsonl' \
  --exclude='./console.jsonl' \
  --exclude='./contracts/out' \
  --exclude='./contracts/cache' \
  --exclude='./contracts/broadcast' \
  --exclude='./lib' \
  --exclude='./contracts/contract-metadata/*.json' \
  -cf - . | tar -xf - -C "$DEST"
cp .env.example "$DEST/.env.example"
# Drop Arc Studio platform deploy helpers: they need packages that only exist inside Arc Studio.
rm -f "$DEST/scripts/compass-deploy.ts" "$DEST/scripts/compass-deploy-helpers.ts" "$DEST/scripts/self-deploy.ts" "$DEST/scripts/fetch-abi.ts"
rm -f "$DEST/contracts/script/Create2Factory.sol" "$DEST/contracts/script/DeployCreate2.s.sol"
python3 - "$DEST/package.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
for key in ("deploy:self", "compass:deploy", "fetch:abi"):
    data["scripts"].pop(key, None)
json.dump(data, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY
# Safety scan: fail if anything credential-shaped slipped in.
if grep -rIlE --exclude=export-clean.sh '(PRIVATE_KEY=[0-9a-fA-Fx]{20,}|CIRCLE_API_KEY=|ENTITY_SECRET=|TEST_API_KEY|-----BEGIN [A-Z ]*PRIVATE KEY-----)' "$DEST"; then
  echo "export-clean: credential-like content found above; aborting" >&2
  rm -rf "$DEST"
  exit 1
fi
if find "$DEST" -name '.env' -o -name '.circle' -o -name 'recovery_file*' | grep -q .; then
  echo "export-clean: forbidden file present; aborting" >&2
  rm -rf "$DEST"
  exit 1
fi
tar -czf "$DEST.tar.gz" -C "$(dirname "$DEST")" "$(basename "$DEST")"
echo "export-clean: wrote $DEST ($(find "$DEST" -type f | wc -l) files)"
