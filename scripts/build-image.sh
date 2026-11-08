#!/usr/bin/env bash
# Build an n8n Docker image with the plugin baked in (overlay + seams), from n8n source.
#
#   scripts/build-image.sh <vanilla-n8n-checkout> [image:tag]
#
# <vanilla-n8n-checkout>  a fresh n8n source tree at a release tag (see UPSTREAM / compat).
#                         Must NOT already have the plugin applied.
# [image:tag]             the image to produce. Default: n8n-extras:local.
#
# The image contains official n8n plus the plugin's module and seams. It does NOT contain
# the Data Mapper node: that is the community node n8n-nodes-data-mapper, which a user
# installs at run time from Settings > Community nodes, so it persists in the data volume
# and is never pinned by the image.
#
# Needs Docker with buildx, Node 24+ and pnpm on the build host. The build runs n8n's own
# `pnpm build:docker`, so the module is compiled into the image like any n8n code.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
n8n="$(cd "${1:?usage: build-image.sh <vanilla-n8n-checkout> [image:tag]}" && pwd)"
image="${2:-n8n-extras:local}"
name="${image%:*}"
tag="${image##*:}"
[ "$tag" = "$image" ] && tag="local"

[ -f "$n8n/packages/cli/package.json" ] || { echo "not an n8n checkout: $n8n" >&2; exit 1; }
command -v docker >/dev/null || { echo "docker is required on this host" >&2; exit 1; }

echo "1/3 Applying the plugin to $n8n"
"$here/scripts/apply.sh" "$n8n"

echo "2/3 Installing dependencies"
(cd "$n8n" && pnpm install --frozen-lockfile || pnpm install)

echo "3/3 Building the image $name:$tag (n8n build:docker)"
(cd "$n8n" && IMAGE_BASE_NAME="$name" IMAGE_TAG="$tag" pnpm build:docker)

echo ""
echo "Built $name:$tag — official n8n plus the plugin, with no Data Mapper node baked in."
echo "Run it, then install the community node from Settings > Community nodes:"
echo "  n8n-nodes-data-mapper"
