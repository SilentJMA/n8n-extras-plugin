# Status

Built and tested on n8n commit `3895cb31de5731c8425e56e56ff6f1dad1e2aa50`, which is `n8n@2.47.0` plus 39
commits (see `UPSTREAM`). Supported from the version in `compat/MIN_VERSION`.

## Verified on a clean copy of the base commit

The plugin was applied with `scripts/apply.sh` to a fresh checkout, then installed and built from scratch.

- Backend: `tsc` typecheck has 0 errors. 2,813 unit tests pass (workflows, executions, root tests).
- Backend integration: the module's 11 tests, the executions controller (33 tests) and the workflows
  controller pass.
- Frontend: the editor UI typecheck has 0 errors. The plugin module's tests, the SDK registry tests and the
  seam tests pass. Module lint is clean.
- Nodes: 119 of 119 tests pass.

That full build and test run was done before module registration moved from the patch into
`scripts/register-module.mjs`. After that change the plugin was re-applied to a clean copy of the base
commit and the registration was compared with the working tree (same result, up to line order), but the
full build and test run was not repeated.

## Verified against other n8n releases (dry run only)

`scripts/check-upstream.sh` applied the patch and the module registration to clean checkouts of
`n8n@2.47.0` and `n8n@2.47.2` without conflicts. `n8n@2.46.6` (the latest stable at the time) is older than
the supported range, and the patch does not apply to it. These are dry runs; those releases were not built
or tested. Every check is recorded in `compat/releases.tsv`.

## Verified in a browser (local instance)

Run from a patched checkout with the editor UI built, signed in as a test owner:

- Published tab on Overview and on a project page, including workflows inside folders.
- Expandable folders (the instance had the folders feature enabled): the chevron lists the folder's
  workflows; clicking a workflow name opens it (breadcrumb shows its folder); clicking the folder card still
  opens the folder.
- Pause and resume: badge, button and toasts. The database showed the trigger mapping removed on pause and
  restored on resume, with the workflow staying published.
- Execute from the `...` menu: created a manual execution that recorded who ran it.
- Executions page: the user's name next to manual runs, and the Run type and Run by filters.
- Settings > Integrations > Plugins: the five switches save and persist.

Bugs found by this pass and fixed (each has a test): the list ignored query-only changes to the status
filter; a status filter did not search inside folders on a project page; the folder content linked to a
wrong route name; and the "Automatic" run type was dropped because a helper treated `false` as empty.

## Visual Data Mapper

A **pure extension**, with no node of its own. The plugin adds the `parameterInputs` seam, the visual mapper
in the frontend module and the `visualDataMapper` switch. The Data Mapper node is the community package
[n8n-nodes-data-mapper](https://www.npmjs.com/package/n8n-nodes-data-mapper); its **Visual Mapping** parameter
declares `extensionComponent: 'extras.dataMapper'`, which the module draws. Detection is declarative: node
installed and plugin on → the mapper draws; plugin off → plain JSON; node not installed → nothing. The
module's engine copy is kept in step with the node by `scripts/sync-data-mapper-engine.sh`.

- Frontend: the module's 30 tests (4 for the mapper), the SDK's 123 tests and the 78 `ParameterInputList`
  tests (2 for the seam) pass. The seam test fails without the seam. Module lint and `vue-tsc` are clean.
- Browser, local instance with the community node `n8n-nodes-data-mapper` 0.5.2 installed: the plugin detects
  the node and draws the mapper for its Visual Mapping field — trees, function boxes and lines; selecting a
  function highlights its path in purple; the function editor edits inputs and outputs.
- `scripts/apply.sh --check` passes on clean checkouts of the base commit and of `n8n@2.47.2`.

The node's own tests (functions, saved mappings, the Visual Mapper mode) live in the community node
repository and are not part of this plugin.

Not verified for this change: Docker, a run on Unraid, and the editor UI typecheck of the whole app.

## Known flakiness

On the first, cold-cache run of the editor UI tests, a few tests timed out at 5 seconds, in files the plugin
does not add. A different few failed on each rerun, and they passed with a longer timeout. A baseline run on
vanilla n8n was not done, so this is not proven to be unrelated.

## Not verified

- **Docker.** The image is built from a patched checkout with n8n's own `pnpm build:docker`; this has never
  been built or run here. The plugin no longer ships a Docker file of its own.
- **The upstream-watch workflow on GitHub.** `scripts/watch-upstream.sh` was run locally against the real
  GitHub API; the Actions workflow that calls it has not run on GitHub yet.
- **A trigger actually firing.** Pause was confirmed through the database, but no scheduled run was observed
  being skipped while paused.
- **PostgreSQL.** Tests ran on SQLite only. The migration uses n8n's schema builder but was not run on
  PostgreSQL.

## Limits

- Plugin text is English only (n8n does not read module translations yet).
- Executions from before the plugin was installed show no "run by" user.
- Expandable folders need n8n's folders feature (license).
