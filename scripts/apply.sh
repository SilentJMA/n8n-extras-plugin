#!/usr/bin/env bash
# Apply the plugin to a vanilla n8n checkout.
#
#   scripts/apply.sh <n8n-dir> [--check]
#
# --check  only test that everything applies cleanly; change nothing. Use it before
#          moving to a newer n8n release.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
target="$(cd "${1:?usage: apply.sh <n8n-dir> [--check]}" && pwd)"
mode="${2:-apply}"

[ -f "$target/packages/cli/package.json" ] || { echo "not an n8n checkout: $target" >&2; exit 1; }
cd "$target"

# New files must not collide with files n8n already has.
collisions=0
while IFS= read -r file; do
	if [ -e "$target/$file" ]; then echo "already exists in n8n: $file" >&2; collisions=1; fi
done < <(cd "$here/overlay" && find . -type f | sed 's#^\./##')
[ "$collisions" = 0 ] || { echo "overlay collides with n8n files (is it already applied?)" >&2; exit 1; }

err="$(mktemp)"
if ! git apply --check "$here/patches/core-seams.patch" 2>"$err"; then
	echo "patches/core-seams.patch does not apply to this n8n version:" >&2
	cat "$err" >&2
	rm -f "$err"
	exit 1
fi
rm -f "$err"

if [ "$mode" = "--check" ]; then
	node "$here/scripts/register-module.mjs" "$target" --check >/dev/null || {
		node "$here/scripts/register-module.mjs" "$target" --check >&2
		echo "module registration anchors were not found in this n8n version" >&2
		exit 1
	}
	echo "OK: the plugin applies cleanly to $(git describe --tags --always 2>/dev/null || echo this checkout)"
	exit 0
fi

git apply "$here/patches/core-seams.patch"
cp -R "$here/overlay/." "$target/"
node "$here/scripts/register-module.mjs" "$target"

echo "Applied. Next:"
echo "  pnpm install && pnpm build"
echo "  scripts/build-nodes.sh $target   # optional: Data Mapper and Message Template nodes"
