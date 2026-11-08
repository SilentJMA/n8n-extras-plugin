# Architecture

The plugin is an **overlay** on a vanilla n8n checkout. n8n has no runtime plugin loader (its
"modules" are compiled into the app), so the plugin is built from two parts:

1. **New files** that only add code (`overlay/`), including a backend module and a frontend module.
2. **A small patch** (`patches/core-seams.patch`) that adds *seams*: generic extension points in
   n8n's existing files so a module can plug in without n8n knowing anything about it.

```mermaid
flowchart TB
    subgraph Vanilla["n8n (vanilla release)"]
        direction TB
        Core["Workflows, executions, publication engine"]
        UI["Editor UI: workflow list, folders, executions"]
    end

    subgraph Seams["Seams (patches/core-seams.patch)"]
        direction TB
        S1["PublicationSuppression"]
        S2["ExecutionQueryExtensions"]
        S3["uiExtensionRegistry"]
        S4["Module registration lines"]
    end

    subgraph Overlay["Plugin (overlay/)"]
        direction TB
        BE["Backend module 'extras'<br/>REST API, service, settings"]
        FE["Frontend module 'extras'<br/>Published tab, buttons, filters, settings page"]
        DB[("extras_* tables")]
    end

    Core --- S1
    Core --- S2
    UI --- S3
    S1 --- BE
    S2 --- BE
    S3 --- FE
    S4 --- BE
    S4 --- FE
    BE --- DB
    FE -- "REST /rest/extras/*" --> BE
```

## Why seams instead of editing n8n directly

| Approach | Result |
| --- | --- |
| Edit n8n's files to add each feature | Every n8n release risks a merge conflict in logic you do not own. |
| **Add generic seams once, put the features in a module** | The patch is small and stable. The features live in new files that n8n never touches. |

Each seam is generic: it does not mention any feature of the plugin.

## The seams

| Seam | Where | What it lets a module do |
| --- | --- | --- |
| `PublicationSuppression` | `packages/cli/src/workflows/publication/` | Keep a *published* workflow's triggers and webhooks switched off without unpublishing it. Read by the publication applier, the reconciler and startup activation. |
| `ExecutionQueryExtensions` | `packages/@n8n/db/src/repositories/` | Add filters (through the single `ext` filter key) and extra fields (`ext` on each summary) to the executions list. |
| `uiExtensionRegistry` | `@n8n/frontend-module-sdk` | Contribute components to the workflow card, folder card, executions filter and executions row. Filled at startup for active modules only. |
| Tab options `isActive` and `dynamicRoute.query` | `@n8n/frontend-module-sdk` | A module tab that shares a route with another tab and differs by query string (the Published tab). |
| Module registration | `module-registry.ts`, `modules.config.ts`, `modules.manifest.ts`, vite alias, tsconfig paths | Name the `extras` module so n8n loads it. These are the same lines n8n's own module scaffolder writes. |

Two small behaviours also change in the workflow list itself, whether or not the module is active.
See [compatibility](Compatibility#what-changes-even-when-the-module-is-off).

## Backend

The backend is a regular n8n backend module, `packages/cli/src/modules/extras/`.

```mermaid
flowchart LR
    C["ExtrasController<br/>/rest/extras/*"] --> S["ExtrasService"]
    C --> ST["ExtrasSettingsService"]
    S --> R1[("extras_workflow_pause")]
    S --> R2[("extras_execution_actor")]
    ST --> R3[("extras_setting")]
    S --> WR["WorkflowRunner<br/>(n8n)"]
    S --> OB["Publication outbox<br/>(n8n)"]
    M["ExtrasModule.init()"] -- registers --> Q["extrasExecutionQueryExtension"]
    M -- registers --> P["suppressed-ids provider"]
    M -- listens --> E["'workflow-executed' event"]
    E --> S
```

### Pause and resume

Pausing never changes the workflow's publication. It records the pause in the plugin's own table and
asks n8n's publication engine to reconcile.

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Pause button
    participant API as POST /extras/workflows/:id/pause
    participant DB as extras_workflow_pause
    participant OB as Publication outbox
    participant AP as Publication applier
    participant TR as Triggers and webhooks

    U->>UI: click pause
    UI->>API: pause
    API->>DB: insert row for the workflow
    API->>OB: enqueue reconcile (same transaction)
    OB->>AP: apply
    AP->>DB: is it suppressed? (PublicationSuppression)
    DB-->>AP: yes
    AP->>TR: tear down triggers, remove published mapping
    Note over AP,TR: activeVersionId is untouched, so the workflow stays published
    API-->>UI: paused
    UI-->>U: "Paused" badge
```

Resume deletes the row and enqueues the same reconcile. The applier then sees an unsuppressed workflow
and registers its triggers again from the active version.

### Execute from the list and run tracking

```mermaid
sequenceDiagram
    actor U as User
    participant UI as "Execute" menu item
    participant API as POST /extras/workflows/:id/execute
    participant SV as ExtrasService
    participant WR as WorkflowRunner
    participant EV as 'workflow-executed' event
    participant TB as extras_execution_actor

    U->>UI: choose Execute
    UI->>API: execute
    API->>SV: executePublished
    SV->>SV: load active version, pick a startable trigger
    SV->>WR: run as a manual execution (saved)
    WR-->>SV: execution id
    API->>EV: emit (source: user-manual)
    EV->>SV: recordActor(execution id, user)
    SV->>TB: upsert
    API-->>UI: execution started
```

Manual runs from the editor emit the same event, so they are tracked too. The executions list then
asks `ExecutionQueryExtensions` to enrich each summary with `ext.executedByUserId` and to apply the
`manualExecution` and `executedByUserId` filters.

### Data model

The plugin owns three tables and never alters an n8n table.

```mermaid
erDiagram
    workflow_entity ||--o| extras_workflow_pause : "paused"
    execution_entity ||--o| extras_execution_actor : "started by"

    extras_workflow_pause {
        varchar workflowId PK
        varchar pausedByUserId
    }
    extras_execution_actor {
        int executionId PK
        varchar userId
    }
    extras_setting {
        varchar key PK
        text value
    }
```

Both foreign keys cascade on delete, so removing a workflow or an execution cleans up its rows.

## Frontend

The frontend is a regular n8n frontend module, `packages/modules/extras/frontend/`, declared in a
descriptor. The shell reads it at startup.

```mermaid
flowchart TB
    D["extras.module.ts (descriptor)"]
    D --> T["projectTabs: Published tab"]
    D --> SP["settingsPages: Plugins (Integrations)"]
    D --> UX["uiExtensions"]
    UX --> A["workflowCardActions: WorkflowPauseButton"]
    UX --> M["workflowCardMenu: Execute"]
    UX --> F1["folderCardToggle: FolderExpandToggle"]
    UX --> F2["folderCardContent: FolderWorkflows"]
    UX --> X1["executionFilterFields: ExecutionRunFilter"]
    UX --> X2["executionRowCells: ExecutionRunBy"]
    REG["uiExtensionRegistry"]
    UX -- "registered if the module is active" --> REG
    REG --> CARD["WorkflowCard, FolderCard,<br/>ExecutionsFilter, ExecutionsListItem"]
```

A module that is not active contributes nothing, so the shell components render exactly as they do in
vanilla n8n.

## The nodes

Data Mapper and Message Template are **custom nodes**, built from `nodes/` and loaded through n8n's
`N8N_CUSTOM_EXTENSIONS` setting. They are independent of the module and of the patch.
