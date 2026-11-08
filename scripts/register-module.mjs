#!/usr/bin/env node
// Registers the `extras` module in an n8n checkout.
//
//   node scripts/register-module.mjs <n8n-dir> [--check]
//
// These are the one-line registrations n8n's own module scaffolder writes (module name lists, the
// frontend alias, the manifest). They are done here, by anchor, instead of in the patch: a diff hunk
// breaks as soon as a neighbouring line changes, an anchor does not. The script is idempotent.
//
// --check  verify that every anchor is found and change nothing.

import fs from 'node:fs';
import path from 'node:path';

const [, , root, flag] = process.argv;
const check = flag === '--check';

if (!root) {
	console.error('usage: register-module.mjs <n8n-dir> [--check]');
	process.exit(2);
}

/** Returns the indentation of the line that starts at `index`. */
const indentAt = (text, index) => /^[\t ]*/.exec(text.slice(index))[0];

/** Index of the first character after the line that contains `index`. */
const nextLineStart = (text, index) => {
	const end = text.indexOf('\n', index);
	return end === -1 ? text.length : end + 1;
};

function insertAfterLine(text, anchorIndex, build) {
	const at = nextLineStart(text, anchorIndex);
	const indent = indentAt(text, at);
	return text.slice(0, at) + build(indent) + text.slice(at);
}

const EDITS = [
	{
		file: 'packages/@n8n/backend-common/src/modules/modules.config.ts',
		done: (t) => t.includes("'extras'"),
		apply(t) {
			const start = t.indexOf('export const MODULE_NAMES = [');
			const end = t.indexOf('] as const;', start);
			if (start === -1 || end === -1) throw new Error('MODULE_NAMES list not found');
			return `${t.slice(0, end)}\t'extras',\n${t.slice(end)}`;
		},
	},
	{
		file: 'packages/@n8n/backend-common/src/modules/module-registry.ts',
		done: (t) => t.includes("'extras'"),
		apply(t) {
			const start = t.indexOf('defaultModules');
			const end = start === -1 ? -1 : t.indexOf('\n\t];', start);
			if (end === -1) throw new Error('defaultModules list not found');
			return `${t.slice(0, end)}\n\t\t'extras',${t.slice(end)}`;
		},
	},
	{
		file: 'packages/frontend/editor-ui/tsconfig.json',
		done: (t) => t.includes('@n8n/frontend-module-extras'),
		apply(t) {
			const anchor = t.indexOf('"paths": {');
			if (anchor === -1) throw new Error('compilerOptions.paths not found');
			return insertAfterLine(
				t,
				anchor,
				(i) =>
					`${i}"@n8n/frontend-module-extras": ["../../modules/extras/frontend/src/index.ts"],\n` +
					`${i}"@n8n/frontend-module-extras/*": ["../../modules/extras/frontend/src/*"],\n`,
			);
		},
	},
	{
		file: 'packages/frontend/editor-ui/package.json',
		done: (t) => t.includes('@n8n/frontend-module-extras'),
		apply(t) {
			const anchor = t.indexOf('"devDependencies": {');
			if (anchor === -1) throw new Error('devDependencies not found');
			return insertAfterLine(t, anchor, (i) => `${i}"@n8n/frontend-module-extras": "workspace:*",\n`);
		},
	},
	{
		file: 'packages/frontend/@n8n/frontend-vite-config/index.ts',
		done: (t) => t.includes('frontend-module-extras'),
		apply(t) {
			const match = /^.*\{ name: '@n8n\/frontend-module-[^']+', dir: 'modules\/.*$/m.exec(t);
			if (!match) throw new Error('frontend module alias list not found');
			const indent = indentAt(t, match.index);
			return insertAfterLine(
				t,
				match.index,
				() => `${indent}{ name: '@n8n/frontend-module-extras', dir: 'modules/extras/frontend' },\n`,
			);
		},
	},
	{
		file: 'packages/frontend/editor-ui/src/app/modules.manifest.ts',
		done: (t) => t.includes('ExtrasModule'),
		apply(t) {
			const imports = [...t.matchAll(/^import .*$/gm)];
			const arrayStart = t.indexOf('export const modules');
			const arrayEnd = arrayStart === -1 ? -1 : t.indexOf('\n];', arrayStart);
			if (imports.length === 0 || arrayEnd === -1) throw new Error('modules manifest not found');
			// Last in the list, so its tabs are placed after the other modules' tabs.
			const withEntry = `${t.slice(0, arrayEnd)}\n\tExtrasModule,${t.slice(arrayEnd)}`;
			const last = imports.at(-1);
			const at = last.index + last[0].length;
			return `${withEntry.slice(0, at)}\nimport { ExtrasModule } from '@n8n/frontend-module-extras';${withEntry.slice(at)}`;
		},
	},
	{
		file: 'packages/cli/test/integration/shared/types.ts',
		optional: true,
		done: (t) => t.includes("'extras'"),
		apply(t) {
			const start = t.indexOf('type ModuleName =');
			const end = start === -1 ? -1 : t.indexOf(';', start);
			if (end === -1) throw new Error('test ModuleName union not found');
			return `${t.slice(0, end)}\n\t| 'extras'${t.slice(end)}`;
		},
	},
];

let failed = false;
for (const edit of EDITS) {
	const file = path.join(root, edit.file);
	if (!fs.existsSync(file)) {
		const level = edit.optional ? 'skip' : 'MISSING';
		console.log(`${level}  ${edit.file}`);
		failed ||= !edit.optional;
		continue;
	}
	const text = fs.readFileSync(file, 'utf8');
	if (edit.done(text)) {
		console.log(`ok     ${edit.file} (already registered)`);
		continue;
	}
	try {
		const next = edit.apply(text);
		if (!check) fs.writeFileSync(file, next);
		console.log(`${check ? 'would ' : ''}edit  ${edit.file}`);
	} catch (error) {
		console.log(`FAIL   ${edit.file}: ${error.message}`);
		failed = true;
	}
}

process.exit(failed ? 1 : 0);
