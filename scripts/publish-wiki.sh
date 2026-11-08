#!/usr/bin/env bash
# Push wiki/ to the repository's GitHub wiki.
#
#   scripts/publish-wiki.sh
#
# Rebuilds wiki/ from docs/, then pushes it to <repo>.wiki.git. GitHub creates the wiki repository only
# once the first page exists, so on a brand-new repository create any page in the web UI first
# (repository > Wiki > "Create the first page"); this script then replaces everything.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
remote="$(git -C "$here" remote get-url origin)"
wiki_remote="${remote%.git}.wiki.git"

node "$here/scripts/build-wiki.mjs"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ! git clone --quiet "$wiki_remote" "$tmp/wiki" 2>/dev/null; then
	echo "Cannot clone $wiki_remote." >&2
	echo "The wiki does not exist yet (or wikis are not available for this repository)." >&2
	echo "Create the first page in the web UI, then run this again." >&2
	exit 1
fi

# Replace the wiki's content with the generated pages.
find "$tmp/wiki" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$here/wiki/." "$tmp/wiki/"

cd "$tmp/wiki"
git add -A
if git diff --cached --quiet; then
	echo "Wiki is already up to date."
	exit 0
fi
git commit --quiet -m "Update wiki from docs"
git push --quiet origin HEAD
echo "Wiki updated: ${remote%.git}/wiki"
