# Troubleshooting

## n8n will not start

**"Your Node.js version is currently not supported"**: n8n needs Node 24 or newer. Check which `node`
is first on your path.

**"Could not initialize the vm expression engine" / "IsolatePool failed to create any bridges"**: the
native `isolated-vm` module was built for a different Node version than the one you run. Reinstall with
the Node version you will run n8n with, or rebuild it:

```bash
pnpm rebuild isolated-vm
```

A stale locally built binary (`.../isolated-vm/build/Release/isolated_vm.node`) can shadow the correct
prebuilt one. Removing the `build` folder lets the matching prebuild load.

**"Cannot find module '../dist/config'"**: the `cli` package is not built. Run `pnpm build`.

**"port 5678 is already in use"**: another n8n is running. Stop it first.

## The plugin does not appear

1. Check the module is active: signed in, `GET /rest/settings` lists `extras` under `activeModules`.
2. Check `N8N_DISABLED_MODULES` does not contain `extras`.
3. Check the plugin's switches in **Settings > Integrations > Plugins**.
4. The first start after applying the plugin runs its migration; look for errors in the n8n log.

## The UI does not show my change

n8n reads the built `index.html` once at startup. After rebuilding the editor UI, **restart n8n**, then
hard-reload the browser (Cmd+Shift+R or Ctrl+Shift+R).

## Specific symptoms

| Symptom | Cause |
| --- | --- |
| No chevron on folder cards | Folders need n8n's folders feature (license), or the "Expandable folders" switch is off. |
| A workflow will not publish | n8n needs a real trigger node. A Manual Trigger alone does not count; add a Schedule, webhook or app trigger. |
| "Execute" returns an error about no trigger | The workflow's only trigger is a webhook. Open it in the editor to run it. |
| Pause button missing | The workflow is not published, is archived, or you lack the unpublish (or publish) permission. |
| No name next to a manual run | The run happened before the plugin was installed, or "Execution tracking" is off. |
| The Published tab shows drafts after a click | An old UI bundle is cached; restart n8n and hard-reload. |

## Applying the plugin fails

| Message | Meaning |
| --- | --- |
| `overlay collides with n8n files` | The plugin is already applied to this checkout. |
| `patches/core-seams.patch does not apply` | This n8n version changed a file the patch edits. See [updating](Updating#when-a-release-does-not-apply). |
| `module registration anchors were not found` | A registration file changed shape. Update that anchor in `scripts/register-module.mjs`. |
