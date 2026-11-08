#!/usr/bin/env bash
# Build the Data Mapper and Message Template nodes into nodes/dist.
#
#   scripts/build-nodes.sh <n8n-dir>
#
# n8n loads them as custom nodes: start it with N8N_CUSTOM_EXTENSIONS=<path to nodes/dist>.
# They are not part of n8n's own packages, so no n8n file is touched.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
n8n="${1:?usage: build-nodes.sh <n8n-dir>}"
nodes="$here/nodes"

[ -f "$n8n/packages/workflow/package.json" ] || { echo "not an n8n checkout: $n8n" >&2; exit 1; }

# Types and runtime come from the n8n checkout's own `n8n-workflow` package.
mkdir -p "$nodes/node_modules"
ln -sfn "$n8n/packages/workflow" "$nodes/node_modules/n8n-workflow"

rm -rf "$nodes/dist"
(cd "$n8n" && pnpm exec tsc -p "$nodes/tsconfig.json")

# Icons and codex files sit next to each node.
(cd "$nodes" && find DataMapper MessageTemplate -type f \( -name '*.svg' -o -name '*.node.json' \) \
	-exec sh -c 'mkdir -p "dist/$(dirname "$1")" && cp "$1" "dist/$1"' _ {} \;)

rm -f "$nodes/node_modules/n8n-workflow"
rmdir "$nodes/node_modules" 2>/dev/null || true
echo "Built nodes into $nodes/dist"
echo "Run n8n with: N8N_CUSTOM_EXTENSIONS=$nodes/dist"
