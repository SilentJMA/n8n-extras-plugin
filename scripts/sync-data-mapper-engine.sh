#!/usr/bin/env bash
# Copy the Data Mapper engine from the community node into the frontend module of a
# patched n8n checkout, so the visual mapper reads profiles exactly like the node.
#
#   scripts/sync-data-mapper-engine.sh <patched-n8n-dir> [community-node-dir]
#
# The community node (npm: n8n-nodes-data-mapper) is the source of truth for the engine.
# <community-node-dir> defaults to a sibling checkout at ../n8n-map-node. It must hold the
# node's TypeScript sources at nodes/DataMapper. Run this after changing the node's engine,
# then export with export-from-fork.sh.
# tree.ts and index.ts belong to the module and are not copied.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
n8n="${1:?usage: sync-data-mapper-engine.sh <patched-n8n-dir> [community-node-dir]}"
node_dir="${2:-$here/../n8n-map-node}"
src="$node_dir/nodes/DataMapper"
module="$n8n/packages/modules/extras/frontend"
engine="$module/src/components/dataMapper/engine"

[ -d "$engine" ] || { echo "not a patched n8n checkout: $engine is missing" >&2; exit 1; }
[ -d "$src" ] || { echo "community node sources not found: $src (pass the checkout as arg 2)" >&2; exit 1; }

for file in mapping.ts profile.ts xml.ts function-catalog.ts; do
	cp "$src/$file" "$engine/$file"
done

# Format the copies the way the module formats its own files.
(cd "$module" && pnpm exec biome format --write src/components/dataMapper/engine >/dev/null)
echo "Synced the Data Mapper engine from $src into $engine"
