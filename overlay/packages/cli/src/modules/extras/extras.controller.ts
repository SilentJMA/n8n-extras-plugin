import type { AuthenticatedRequest } from '@n8n/db';
import { GlobalScope, Get, Patch, Post, ProjectScope, RestController } from '@n8n/decorators';
import { EventService } from '@n8n/backend-services';
import { BadRequestError } from '@n8n/errors';

import { AuthService } from '@/auth/auth.service';

import { ExtrasSettingsService } from './extras-settings.service';
import { EXTRAS_FEATURES, type ExtrasFeatures } from './extras.constants';
import { ExtrasService } from './extras.service';

@RestController('/extras')
export class ExtrasController {
	constructor(
		private readonly extrasService: ExtrasService,
		private readonly settings: ExtrasSettingsService,
		private readonly authService: AuthService,
		private readonly eventService: EventService,
	) {}

	/** What the editor needs to render the plugin's UI. Readable by every signed-in user. */
	@Get('/state')
	async getState() {
		return {
			features: await this.settings.getFeatures(),
			pausedWorkflowIds: await this.extrasService.listPausedWorkflowIds(),
		};
	}

	@Patch('/settings')
	@GlobalScope('communityPackage:install')
	async updateSettings(req: AuthenticatedRequest<{}, {}, { features?: Partial<ExtrasFeatures> }>) {
		// Validated by hand: the body is a small flat map of known booleans.
		const features = req.body?.features;
		if (!features || typeof features !== 'object') {
			throw new BadRequestError('Expected a "features" object');
		}
		for (const key of Object.keys(features)) {
			if (!(EXTRAS_FEATURES as readonly string[]).includes(key)) {
				throw new BadRequestError(`Unknown feature "${key}"`);
			}
		}
		return { features: await this.settings.updateFeatures(features) };
	}

	@Post('/workflows/:workflowId/pause')
	@ProjectScope('workflow:unpublish')
	async pause(req: AuthenticatedRequest<{ workflowId: string }>) {
		return await this.extrasService.pause(req.params.workflowId, req.user);
	}

	@Post('/workflows/:workflowId/resume')
	@ProjectScope('workflow:publish')
	async resume(req: AuthenticatedRequest<{ workflowId: string }>) {
		return await this.extrasService.resume(req.params.workflowId);
	}

	@Post('/workflows/:workflowId/execute')
	@ProjectScope('workflow:execute')
	async execute(req: AuthenticatedRequest<{ workflowId: string }>) {
		const { workflowId } = req.params;
		const { executionId, projectId, projectName } = await this.extrasService.executePublished(
			workflowId,
			req.user,
			req.headers['push-ref'] as string | undefined,
			this.authService.getCookieToken(req),
		);

		this.eventService.emit('workflow-executed', {
			user: {
				id: req.user.id,
				email: req.user.email,
				firstName: req.user.firstName,
				lastName: req.user.lastName,
				role: req.user.role,
			},
			workflowId,
			workflowName: '',
			executionId,
			projectId,
			projectName,
			source: 'user-manual',
		});

		return { executionId };
	}
}
