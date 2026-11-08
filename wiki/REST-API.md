# REST API

All endpoints are under n8n's REST prefix (`/rest`) and need a signed-in session, like the rest of the
editor's API. The module id is `extras`.

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /rest/extras/state` | signed in | The feature switches and the ids of paused workflows. |
| `PATCH /rest/extras/settings` | global scope `communityPackage:install` | Switch features on or off. |
| `POST /rest/extras/workflows/:id/pause` | project scope `workflow:unpublish` | Pause a published workflow. |
| `POST /rest/extras/workflows/:id/resume` | project scope `workflow:publish` | Resume a paused workflow. |
| `POST /rest/extras/workflows/:id/execute` | project scope `workflow:execute` | Run the published version once. |

## State

```http
GET /rest/extras/state
```

```json
{
  "data": {
    "features": {
      "publishedTab": true,
      "folderExpand": true,
      "executeFromList": true,
      "pauseResume": true,
      "executionTracking": true
    },
    "pausedWorkflowIds": ["9Ir1QR0mUeWkx0fG"]
  }
}
```

## Settings

```http
PATCH /rest/extras/settings
Content-Type: application/json

{ "features": { "pauseResume": false } }
```

Unknown feature names are rejected with `400`. The response has the full feature map.

## Pause, resume, execute

| Call | Success response | Errors |
| --- | --- | --- |
| `pause` | `{ "data": { "id": "...", "paused": true } }` | `400` not published, `403` feature off or no permission, `404` unknown workflow |
| `resume` | `{ "data": { "id": "...", "paused": false } }` | same |
| `execute` | `{ "data": { "executionId": "..." } }` | `400` not published or no startable trigger, `403` feature off, read-only instance or no permission |

`execute` always saves the execution and emits n8n's `workflow-executed` event with source `user-manual`,
which is how the run is attributed to the user.

## Execution filters

The plugin extends n8n's executions list through the single `ext` filter key.

```http
GET /rest/executions?filter={"ext":{"manualExecution":true,"executedByUserId":"<user id>"}}
```

| `ext` key | Type | Meaning |
| --- | --- | --- |
| `manualExecution` | boolean | `true`: only manual executions. `false`: only non-manual executions. |
| `executedByUserId` | string | Only executions started by that user. |

Each execution summary in the response carries `ext.executedByUserId` for manual runs that were
attributed to a user.
