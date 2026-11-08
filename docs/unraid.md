# Run on Unraid (or any Docker host)

The easy way is a **prebuilt image**: official n8n with the plugin baked in. You pull it — no building,
no Node or pnpm. The image is published to GitHub Container Registry:

```
ghcr.io/silentjma/n8n-extras:latest
```

The image is **official n8n plus the plugin**. It does **not** contain the Data Mapper node — you install
that node once from the n8n UI, so it lives in your data volume and the image never pins it. To take a newer
n8n release, pull a newer tag; your data and the installed node stay put.

## Quick start (any Docker host)

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  ghcr.io/silentjma/n8n-extras:latest
```

Or with Compose:

```yaml
services:
  n8n:
    image: ghcr.io/silentjma/n8n-extras:latest
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped
volumes:
  n8n_data:
```

Then do steps 3 and 4 below.

## 1. Deploy on Unraid

Add a container (**Docker > Add Container**), or edit your existing n8n container to use this image:

| Setting | Value |
| --- | --- |
| Repository | `ghcr.io/silentjma/n8n-extras:latest` |
| Port | `5678` → `5678` |
| Path | `/mnt/user/appdata/n8n` → `/home/node/.n8n` |

Point it at your existing **appdata/n8n** folder so your workflows, credentials and encryption key carry
over. Switching image changes nothing in that folder.

## 2. Install the Data Mapper node from the UI

Open n8n, then **Settings > Community nodes > Install** and enter:

```
n8n-nodes-data-mapper
```

It installs into `appdata/n8n/nodes`, so it survives restarts and image updates. If your folder already has
an older version, open **Community nodes** and update it to the latest.

## 3. Switch on the Visual Data Mapper

**Settings > Integrations > Plugins** > turn on **Visual Data Mapper**. Now, in a **Data Mapper** node,
**Define Mappings > Visual Mapper** shows the drag-and-drop canvas. With the switch off, the same map shows
as JSON, so the node always works.

## Updating

- **The plugin / n8n version:** pull a newer image tag (for example `ghcr.io/silentjma/n8n-extras:2.47.2`),
  or re-pull `:latest`, and restart. Your data and the installed node stay in `appdata/n8n`.
- **The Data Mapper node only:** update it in **Settings > Community nodes**, no image change needed.

The image is published by the **Publish image to GHCR** GitHub Actions workflow in this repository, built
from a supported n8n release with the overlay applied (see [compatibility](compatibility.md)). After the
first publish, set the GHCR package to **Public** once (its page on GitHub > Package settings > Change
visibility) so anyone can pull it without signing in.

## Appendix: build the image yourself

If you would rather build it (a private registry, a pinned n8n commit, or no access to the published image),
use a machine with Docker (buildx), Node 24+ and pnpm:

```bash
git clone https://github.com/n8n-io/n8n.git n8n && cd n8n
git checkout n8n@2.47.2                 # a supported release (see compat/releases.tsv)

/path/to/n8n-extras-plugin/scripts/build-image.sh . n8n-extras:2.47.2
```

`scripts/build-image.sh` applies the overlay and runs n8n's own `pnpm build:docker`, producing a local
`n8n-extras:2.47.2` with no Data Mapper node inside. Push it to your registry, or copy it with
`docker save | docker load`, then deploy it as above.
