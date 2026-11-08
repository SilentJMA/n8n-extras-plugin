#!/usr/bin/env bash
# Run the Data Mapper and Message Template node tests against the built nodes.
#
#   scripts/test-nodes.sh <n8n-dir>      (run build-nodes.sh first)
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
n8n="${1:?usage: test-nodes.sh <n8n-dir>}"
nodes="$here/nodes"

[ -d "$nodes/dist" ] || { echo "build the nodes first: scripts/build-nodes.sh $n8n" >&2; exit 1; }

# The built nodes need `n8n-workflow` at runtime; borrow the one from the n8n checkout.
mkdir -p "$nodes/node_modules"
ln -sfn "$n8n/packages/workflow" "$nodes/node_modules/n8n-workflow"
trap 'rm -f "$nodes/node_modules/n8n-workflow"; rmdir "$nodes/node_modules" 2>/dev/null || true' EXIT

cd "$nodes"
node --test test/data-mapper/test/ test/message-template/test/
