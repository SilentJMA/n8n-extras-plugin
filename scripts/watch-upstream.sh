#!/usr/bin/env bash
# Look for new n8n releases and record whether the plugin still applies to them.
#
#   scripts/watch-upstream.sh [--dry-run]
#
# For the latest stable release and the newest pre-release of n8n that are not recorded yet:
#   1. runs scripts/check-upstream.sh (a dry-run apply, nothing is changed)
#   2. appends the result to compat/releases.tsv
#   3. regenerates the compatibility table in docs/compatibility.md
#
# Writes a short report to $GITHUB_OUTPUT (if set): `changed=true|false`, `conflicts=<tags>`.
# Needs: git, gh (authenticated), node. Used by .github/workflows/upstream-watch.yml.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
dry="${1:-}"
ledger="$here/compat/releases.tsv"
mkdir -p "$here/compat"
[ -f "$ledger" ] || printf 'tag\tresult\tchecked\n' >"$ledger"

# Candidate tags: the latest stable release and the newest pre-release.
releases="$(gh api 'repos/n8n-io/n8n/releases?per_page=30' --jq '.[] | "\(.tag_name)\t\(.prerelease)"')"
stable="$(printf '%s\n' "$releases" | awk -F'\t' '$1 ~ /^n8n@/ && $2=="false" {print $1; exit}')"
pre="$(printf '%s\n' "$releases" | awk -F'\t' '$1 ~ /^n8n@/ && $2=="true" {print $1; exit}')"

min="$(tr -d '[:space:]' <"$here/compat/MIN_VERSION")"
# True when the release is older than the oldest n8n version the plugin was built for.
older_than_min() {
	[ "$(printf '%s\n%s\n' "${1#n8n@}" "$min" | sort -V | head -n1)" != "$min" ]
}

changed=false
conflicts=""

for tag in $stable $pre; do
	result=
	if cut -f1 "$ledger" | grep -qx "$tag"; then
		echo "already recorded: $tag"
		continue
	fi

	if older_than_min "$tag"; then
		echo "$tag is older than $min: not supported"
		result=unsupported
	else
		echo "checking $tag ..."
	fi

	if [ "${result:-}" = unsupported ]; then
		:
	elif "$here/scripts/check-upstream.sh" "$tag" >/tmp/watch-upstream.log 2>&1; then
		result=applies
	else
		result=conflict
		conflicts="$conflicts $tag"
		cat /tmp/watch-upstream.log
	fi

	if [ "$dry" != "--dry-run" ]; then
		printf '%s\t%s\t%s\n' "$tag" "$result" "$(date -u +%Y-%m-%d)" >>"$ledger"
		changed=true
	else
		echo "(dry run) $tag -> $result"
	fi
done

[ "$dry" = "--dry-run" ] || node "$here/scripts/update-compat-table.mjs"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
	{
		echo "changed=$changed"
		echo "conflicts=${conflicts# }"
	} >>"$GITHUB_OUTPUT"
fi
