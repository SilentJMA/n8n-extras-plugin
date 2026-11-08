#!/usr/bin/env bash
# Does the plugin still apply to a newer n8n release?
#
#   scripts/check-upstream.sh <git-tag-or-ref>      e.g. n8n@2.3.0
#
# Clones n8n at that ref into a temporary directory and runs `apply.sh --check`.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
ref="${1:?usage: check-upstream.sh <git-tag-or-ref>}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 --branch "$ref" https://github.com/n8n-io/n8n.git "$tmp/n8n"
"$here/scripts/apply.sh" "$tmp/n8n" --check
