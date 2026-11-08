# AGENT.md

Guidance for automated coding agents (and new contributors) working in this repository.

## What this repository is

A plugin for [n8n](https://github.com/n8n-io/n8n), packaged as an **overlay**: new files in `overlay/`,
a small patch in `patches/core-seams.patch`, and a script that registers the module by anchor. It is
applied to a vanilla n8n source checkout. It is **not** a fork of n8n and must never become one.

Goals, in order:

1. Stay compatible with new n8n releases with as little work as possible.
2. Never change n8n's behaviour, data or tables when the module is off.
3. Keep the footprint in n8n's own files as small and generic as possible.

## Read first

| File | Why |
| --- | --- |
| `README.md` | What it does. |
| `docs/architecture.md` | The seams, the module, the data model. |
| `docs/compatibility.md` | What the plugin touches and what is promised. |
| `docs/development.md` | The working loop and the tests. |

## Hard rules

- **Do not edit `overlay/` or `patches/` by hand.** They are generated. Apply the plugin to an n8n
  checkout, change code there, and regenerate with `scripts/export-from-fork.sh`.
- **Do not alter any n8n database table.** Add plugin tables with a new migration only.
- **Seams stay generic.** A change to an existing n8n file must not mention a feature of the plugin
  (pause, execute, run tracking). It adds an extension point, and the feature uses it.
- **Prefer a new file to an edit.** If an existing n8n file must change, keep the edit minimal and cover
  it with a test.
- **Module registration lives in `scripts/register-module.mjs`**, as anchors, not in the patch.
- **No outbound network calls, no telemetry, no secrets in the repository.**
- **Do not commit build output** (`dist/`, `node_modules/`).

## The loop

```bash
# 1. a clean checkout at the base commit (see UPSTREAM)
git clone https://github.com/n8n-io/n8n.git ~/n8n && cd ~/n8n && git checkout $(sed -n 's/^commit=//p' /path/to/repo/UPSTREAM)

# 2. apply, then work in ~/n8n
/path/to/repo/scripts/apply.sh ~/n8n

# 3. regenerate the repository from your working tree
/path/to/repo/scripts/export-from-fork.sh ~/n8n "$(sed -n 's/^commit=//p' /path/to/repo/UPSTREAM)"

# 4. prove it on a fresh clone
/path/to/repo/scripts/apply.sh <fresh-clone-at-base-commit> --check
```

## Verify before you say it is done

| Change | Check |
| --- | --- |
| Backend module or seams | The backend integration tests in `docs/development.md#tests`, and `tsc --noEmit` in `packages/cli`. |
| Frontend module | `vitest run`, `eslint src --quiet` and `vue-tsc --noEmit` in `packages/modules/extras/frontend`. |
| Anything in the editor UI | The editor UI tests listed in `docs/development.md`, **and look at the page in a browser.** Component tests stub parts of the app and cannot catch a wrong route name or a mis-wired import. |
| The patch or registration | `scripts/apply.sh <fresh clone> --check` against the base commit and the releases in `compat/releases.tsv`. |
| A new test | Show it fails without the change and passes with it. |

Report what was and was not verified. If you could not run something (for example Docker), say so; do not
claim it works.

## Conventions

- TypeScript and Vue, following n8n's own lint and format settings (run `prettier` and the module's
  `biome`/`eslint` configs).
- Plugin text goes through `packages/modules/extras/frontend/src/extras.i18n.ts` (English only for now).
- Icons must come from the design system's current icon set; do not use deprecated icons.
- Imports inside the frontend module are limited to the shared packages the scaffold lists. Do not import
  from the editor UI (`@/…`) and do not import `RouterLink` from `vue-router` in a module component (the
  app registers it globally; a module's own copy renders nothing).
- Backend errors use `@n8n/errors` (`BadRequestError`, `ForbiddenError`, `NotFoundError`).

## Known pitfalls

- A route name or a prop that is wrong can fail silently in Vue. Check the rendered page.
- n8n treats `false` as empty in its `isEmpty` helper. Do not use it on filter objects that can hold
  `false`.
- n8n reads the built `index.html` once at start. Restart it after rebuilding the UI.
- n8n needs Node 24 or newer, and native modules must be built for the Node you run.
- Do not run commands that delete or overwrite a user's n8n data folder.

## Releases

`compat/releases.tsv` records which n8n releases the plugin was checked against; a workflow updates it
daily (`docs/updating.md`). A conflict report names the file to fix. Update `UPSTREAM` and
`compat/MIN_VERSION` only after a full build and test run on the new base.
