import { EventService } from '@n8n/backend-services';
import { ExecutionQueryExtensions } from '@n8n/db';
import type { ModuleInterface } from '@n8n/decorators';
import { BackendModule } from '@n8n/decorators';
import { Container } from '@n8n/di';

/**
 * Optional extras for the workflows and executions pages: pause/resume of published
 * workflows, running a published workflow from the list, and who ran a manual
 * execution (with filters). Switched on and off per feature in
 * Settings > Integrations > Plugins.
 *
 * It plugs into core only through `PublicationSuppression` and `ExecutionQueryExtensions`,
 * and owns its own tables, so removing it leaves the core schema untouched.
 */
@BackendModule({ name: 'extras', instanceTypes: ['main'] })
export class ExtrasModule implements ModuleInterface {
	async init() {
		await import('./extras.controller.js');

		const { ExtrasService } = await import('./extras.service.js');
		const { extrasExecutionQueryExtension } = await import('./extras.query-extension.js');
		const { PublicationSuppression } = await import(
			'@/workflows/publication/publication-suppression.js'
		);

		const extrasService = Container.get(ExtrasService);

		Container.get(ExecutionQueryExtensions).register(extrasExecutionQueryExtension);
		Container.get(PublicationSuppression).register(
			async () => await extrasService.listPausedWorkflowIds(),
		);

		// Every manual run started from the UI records who started it.
		Container.get(EventService).on('workflow-executed', async (event) => {
			if (event.source !== 'user-manual') return;
			if (event.user) await extrasService.recordActor(event.executionId, event.user.id);
		});
	}

	async entities() {
		const { ExtrasWorkflowPause } = await import('./entities/extras-workflow-pause.entity.js');
		const { ExtrasExecutionActor } = await import('./entities/extras-execution-actor.entity.js');
		const { ExtrasSetting } = await import('./entities/extras-setting.entity.js');

		return [ExtrasWorkflowPause, ExtrasExecutionActor, ExtrasSetting];
	}
}
