#!/usr/bin/env node
// Builds wiki/ from docs/ so the GitHub wiki and the docs never drift apart.
//
//   node scripts/build-wiki.mjs [owner/repo]
//
// Page names follow the wiki convention (Home, Features, ...). Links between pages are rewritten to
// wiki links, and links to files elsewhere in the repository become absolute links to the main branch.
// Mermaid diagrams render in the wiki as they do in the repository.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const out = path.join(root, 'wiki');

function detectRepo() {
	if (process.argv[2]) return process.argv[2];
	try {
		const url = execSync('git remote get-url origin', { cwd: root, encoding: 'utf8' }).trim();
		return url.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
	} catch {
		return 'OWNER/REPO';
	}
}

const repo = detectRepo();
const blob = `https://github.com/${repo}/blob/main`;

/** docs file -> wiki page name */
const PAGES = {
	'features.md': 'Features',
	'installation.md': 'Installation',
	'architecture.md': 'Architecture',
	'compatibility.md': 'Compatibility',
	'unraid.md': 'Unraid',
	'updating.md': 'Updating',
	'api.md': 'REST-API',
	'development.md': 'Development',
	'troubleshooting.md': 'Troubleshooting',
};

function rewriteLinks(text) {
	return text.replace(/\]\(([^)\s]+)\)/g, (match, target) => {
		if (/^(https?:|#|mailto:)/.test(target)) return match;

		const [file, anchor] = target.split('#');
		const suffix = anchor ? `#${anchor}` : '';

		if (file.startsWith('images/')) return match;
		if (PAGES[file]) return `](${PAGES[file]}${suffix})`;
		if (file === '../README.md') return '](Home)';
		if (file.startsWith('../')) return `](${blob}/${file.slice(3)}${suffix})`;
		return match;
	});
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'images'), { recursive: true });

for (const image of fs.readdirSync(path.join(docs, 'images'))) {
	fs.copyFileSync(path.join(docs, 'images', image), path.join(out, 'images', image));
}

for (const [file, page] of Object.entries(PAGES)) {
	const text = fs.readFileSync(path.join(docs, file), 'utf8');
	fs.writeFileSync(path.join(out, `${page}.md`), rewriteLinks(text));
}

const home = `# n8n Extras Plugin

A plugin for [n8n](https://github.com/n8n-io/n8n) that adds a **Published tab**, **expandable folders**,
**pause and resume** for published workflows, **execute from the list**, **run tracking with filters**,
and a **Visual Data Mapper** for the community node [n8n-nodes-data-mapper](https://www.npmjs.com/package/n8n-nodes-data-mapper).

> **Built to stay alongside n8n releases without impact.** It adds its own code in new files, creates its
> own three database tables, changes none of n8n's tables, makes no outbound network calls, and every
> feature has an off switch. New n8n releases are checked automatically every day. See
> [Compatibility](Compatibility).

![Published tab](images/published-tab.jpg)

## Pages

| Page | Contents |
| --- | --- |
| [Features](Features) | Every feature with screenshots. |
| [Installation](Installation) | Apply, build, the community node, Docker, uninstall. |
| [Architecture](Architecture) | The seams, the modules, the data model, sequence diagrams. |
| [Compatibility](Compatibility) | What it touches, switching it off, tested releases. |
| [Unraid](Unraid) | Build the image, deploy on Unraid, install the Data Mapper node. |
| [Updating](Updating) | Automatic release watching and upgrading. |
| [REST-API](REST-API) | Endpoints and execution filters. |
| [Development](Development) | Layout, working loop, tests, rules for the seams. |
| [Troubleshooting](Troubleshooting) | Start-up errors and common symptoms. |

The source of these pages is the \`docs/\` folder of the [repository](https://github.com/${repo}); the wiki
is generated from it.
`;

fs.writeFileSync(path.join(out, 'Home.md'), home);

fs.writeFileSync(
	path.join(out, '_Sidebar.md'),
	`**[Home](Home)**

- [Features](Features)
- [Installation](Installation)
- [Architecture](Architecture)
- [Compatibility](Compatibility)
- [Unraid](Unraid)
- [Updating](Updating)
- [REST API](REST-API)
- [Development](Development)
- [Troubleshooting](Troubleshooting)

[Repository](https://github.com/${repo})
`,
);

fs.writeFileSync(
	path.join(out, '_Footer.md'),
	`Generated from \`docs/\` in the repository. Edit the docs, not the wiki.\n`,
);

console.log(`wiki/ built for ${repo}: ${Object.keys(PAGES).length + 1} pages`);
