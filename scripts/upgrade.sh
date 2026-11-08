#!/usr/bin/env bash
# Move a patched n8n checkout to another n8n release, keeping the plugin.
#
#   scripts/upgrade.sh <n8n-dir> <tag>        e.g. scripts/upgrade.sh ~/n8n n8n@2.47.3
#
# 1. Checks that the only uncommitted changes in the checkout are the plugin's own.
# 2. Removes the plugin's changes (and only those).
# 3. Moves n8n to <tag>, checks that the plugin applies, and applies it again.
#
# Nothing is committed for you. If anything other than the plugin has uncommitted changes, it stops
# before touching the checkout.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
target="$(cd "${1:?usage: upgrade.sh <n8n-dir> <tag>}" && pwd)"
tag="${2:?usage: upgrade.sh <n8n-dir> <tag>}"

cd "$target"
git rev-parse --git-dir >/dev/null

# Files the plugin edits: those in the patch, plus the module registration files.
registration=(
	packages/@n8n/backend-common/src/modules/modules.config.ts
	packages/@n8n/backend-common/src/modules/module-registry.ts
	packages/frontend/editor-ui/tsconfig.json
	packages/frontend/editor-ui/package.json
	packages/frontend/@n8n/frontend-vite-config/index.ts
	packages/frontend/editor-ui/src/app/modules.manifest.ts
	packages/cli/test/integration/shared/types.ts
)
edited=()
while IFS= read -r path; do edited+=("$path"); done < <(
	grep '^diff --git' "$here/patches/core-seams.patch" | sed 's#^diff --git a/\(.*\) b/.*#\1#'
)
edited+=("${registration[@]}" pnpm-lock.yaml)

# Files the plugin adds.
added=()
while IFS= read -r path; do added+=("$path"); done < <(
	cd "$here/overlay" && find . -type f | sed 's#^\./##'
)

is_plugin_path() {
	local path="$1" p
	for p in "${edited[@]}" "${added[@]}"; do [ "$p" = "$path" ] && return 0; done
	return 1
}

# Anything uncommitted that is not the plugin's must be dealt with by the user first.
foreign=0
while IFS= read -r line; do
	path="${line:3}"
	if ! is_plugin_path "$path"; then
		echo "uncommitted change outside the plugin: $path" >&2
		foreign=1
	fi
done < <(git status --porcelain --untracked-files=all)
[ "$foreign" = 0 ] || { echo "commit or stash those changes first" >&2; exit 1; }

echo "Removing the plugin from the working tree ..."
for path in "${edited[@]}"; do
	if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then git checkout -- "$path"; fi
done
for path in "${added[@]}"; do rm -f "$path"; done
# Directories the plugin created are now empty.
find packages/cli/src/modules/extras packages/modules/extras -type d -empty -delete 2>/dev/null || true

git fetch --tags --quiet origin 2>/dev/null || true
git checkout --quiet "$tag"

"$here/scripts/apply.sh" "$target" --check
"$here/scripts/apply.sh" "$target"

echo "Now on $tag with the plugin applied. Run: pnpm install && pnpm build"
