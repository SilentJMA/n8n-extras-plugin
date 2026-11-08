#!/usr/bin/env bash
# Copy the Data Mapper engine from the node (nodes/DataMapper) into the frontend module of a
# patched n8n checkout, so the visual mapper reads profiles exactly like the node.
#
#   scripts/sync-data-mapper-engine.sh <patched-n8n-dir>
#
# Run it after changing the engine files of the node, then export with export-from-fork.sh.
# tree.ts and index.ts belong to the module and are not copied.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
n8n="${1:?usage: sync-data-mapper-engine.sh <patched-n8n-dir>}"
module="$n8n/packages/modules/extras/frontend"
engine="$module/src/components/dataMapper/engine"

[ -d "$engine" ] || { echo "not a patched n8n checkout: $engine is missing" >&2; exit 1; }

for file in mapping.ts profile.ts xml.ts function-catalog.ts; do
	cp "$here/nodes/DataMapper/$file" "$engine/$file"
done

# Format the copies the way the module formats its own files.
(cd "$module" && pnpm exec biome format --write src/components/dataMapper/engine >/dev/null)
echo "Synced the Data Mapper engine into $engine"
