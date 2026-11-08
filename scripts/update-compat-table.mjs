#!/usr/bin/env node
// Regenerates the release table in docs/compatibility.md from compat/releases.tsv.
//
//   node scripts/update-compat-table.mjs
//
// The table lives between the <!-- compat:start --> and <!-- compat:end --> markers.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledger = path.join(here, 'compat', 'releases.tsv');
const doc = path.join(here, 'docs', 'compatibility.md');

const rows = fs
	.readFileSync(ledger, 'utf8')
	.trim()
	.split('\n')
	.slice(1)
	.filter(Boolean)
	.map((line) => line.split('\t'));

// Newest first, by version number (n8n@MAJOR.MINOR.PATCH).
const version = (tag) => tag.replace('n8n@', '').split('.').map(Number);
rows.sort((a, b) => {
	const [x, y] = [version(a[0]), version(b[0])];
	for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
	return 0;
});

const label = {
	applies: 'Applies cleanly',
	conflict: 'Needs attention',
	unsupported: 'Older than the supported range',
};
const table = [
	'| n8n release | Result | Checked |',
	'| --- | --- | --- |',
	...rows.map(([tag, result, checked]) => `| \`${tag}\` | ${label[result] ?? result} | ${checked} |`),
].join('\n');

const text = fs.readFileSync(doc, 'utf8');
const start = '<!-- compat:start -->';
const end = '<!-- compat:end -->';
const from = text.indexOf(start);
const to = text.indexOf(end);
if (from === -1 || to === -1) {
	console.error('compat markers not found in docs/compatibility.md');
	process.exit(1);
}

fs.writeFileSync(doc, `${text.slice(0, from + start.length)}\n${table}\n${text.slice(to)}`);
console.log(`updated ${rows.length} rows`);
