import { InstanceWriteAccessService } from '@n8n/backend-services';
import {
	WorkflowPublicationOutboxRepository,
	WorkflowPublicationReason,
	WorkflowRepository,
	type User,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { BadRequestError, ForbiddenError, NotFoundError } from '@n8n/errors';
import { ExecutionContextService } from 'n8n-core';
import {
	MANUAL_TRIGGER_NODE_TYPES,
	type IWorkflowBase,
	type IWorkflowExecutionDataProcess,
} from 'n8n-workflow';

import { NodeTypes } from '@/node-types';
import { OwnershipService } from '@/services/ownership.service';
import { PollTriggerJobRegistrar } from '@/scheduling/poll-trigger-node/poll-trigger-job-registrar';
import { ScheduleTriggerJobRegistrar } from '@/scheduling/schedule-trigger-node/schedule-trigger-job-registrar';
import { WorkflowRunner } from '@/workflow-runner';
import { WorkflowPublicationNotifier } from '@/workflows/publication/workflow-publication-notifier';
import { getWorkflowProjectDetailsSafe } from '@/workflows/utils';

import { ExtrasSettingsService } from './extras-settings.service';
import type { ExtrasFeature } from './extras.constants';
import {
	ExtrasExecutionActorRepository,
	ExtrasWorkflowPauseRepository,
} from './extras.repositories';

@Service()
export class ExtrasService {
	constructor(
		private readonly settings: ExtrasSettingsService,
		private readonly pauseRepository: ExtrasWorkflowPauseRepository,
		private readonly actorRepository: ExtrasExecutionActorRepository,
		private readonly workflowRepository: WorkflowRepository,
		private readonly outboxRepository: WorkflowPublicationOutboxRepository,
		private readonly notifier: WorkflowPublicationNotifier,
		private readonly scheduleTriggerJobRegistrar: ScheduleTriggerJobRegistrar,
		private readonly pollTriggerJobRegistrar: PollTriggerJobRegistrar,
		private readonly nodeTypes: NodeTypes,
		private readonly workflowRunner: WorkflowRunner,
		private readonly ownershipService: OwnershipService,
		private readonly executionContextService: ExecutionContextService,
		private readonly instanceWriteAccess: InstanceWriteAccessService,
	) {}

	// ----------------------------------
	//            pause / resume
	// ----------------------------------

	async listPausedWorkflowIds(): Promise<string[]> {
		if (!(await this.settings.isEnabled('pauseResume'))) return [];
		const rows = await this.pauseRepository.find({ select: { workflowId: true } });
		return rows.map(({ workflowId }) => workflowId);
	}

	async pause(workflowId: string, user: User): Promise<{ id: string; paused: true }> {
		await this.assertEnabled('pauseResume');
		const workflow = await this.getPublishedWorkflow(workflowId);

		await this.workflowRepository.manager.transaction(async (trx) => {
			await trx.upsert(this.pauseRepository.target, { workflowId, pausedByUserId: user.id }, [
				'workflowId',
			]);
			// The publication applier sees the workflow as suppressed and tears its triggers down.
			await this.outboxRepository.enqueue(
				workflowId,
				workflow.activeVersionId!,
				WorkflowPublicationReason.Publish,
				trx,
			);
			// Durable jobs are DB state, so their removal commits here with the pause.
			await this.scheduleTriggerJobRegistrar.removeWorkflowInTransaction(trx, workflowId);
			await this.pollTriggerJobRegistrar.removeWorkflowInTransaction(trx, workflowId);
		});
		this.notifier.requestDrain();

		return { id: workflowId, paused: true };
	}

	async resume(workflowId: string): Promise<{ id: string; paused: false }> {
		await this.assertEnabled('pauseResume');
		const workflow = await this.getPublishedWorkflow(workflowId);

		await this.workflowRepository.manager.transaction(async (trx) => {
			await trx.delete(this.pauseRepository.target, { workflowId });
			// The applier now sees an unsuppressed workflow and registers its triggers again.
			await this.outboxRepository.enqueue(
				workflowId,
				workflow.activeVersionId!,
				WorkflowPublicationReason.Publish,
				trx,
			);
		});
		this.notifier.requestDrain();

		return { id: workflowId, paused: false };
	}

	// ----------------------------------
	//        execute published version
	// ----------------------------------

	/**
	 * Runs the published version once, as a manual execution started by `user`.
	 * It starts from a trigger that can fire without an outside call (Manual Trigger
	 * first); webhook-style triggers need a real caller and are not eligible.
	 * The execution is always saved so it shows up on the Executions page.
	 */
	async executePublished(workflowId: string, user: User, pushRef?: string, n8nAuthCookie?: string) {
		await this.assertEnabled('executeFromList');
		if (this.instanceWriteAccess.isReadOnly()) {
			throw new ForbiddenError(
				'Cannot run workflows manually on a protected instance. This instance is in read-only mode.',
			);
		}

		const workflow = await this.workflowRepository.get(
			{ id: workflowId },
			{ relations: ['activeVersion'] },
		);
		if (!workflow) throw new NotFoundError(`Workflow with ID "${workflowId}" not found`);
		if (!workflow.activeVersion) {
			throw new BadRequestError('Only published workflows can be executed from the list');
		}

		const { nodes, connections, versionId } = workflow.activeVersion;

		const startableTriggers = nodes.filter((node) => {
			if (node.disabled) return false;
			const nodeType = this.nodeTypes.getByNameAndVersion(node.type, node.typeVersion);
			return (
				nodeType.description.group.includes('trigger') &&
				nodeType.webhook === undefined &&
				!nodeType.description.webhooks?.length
			);
		});
		const trigger =
			startableTriggers.find((node) => MANUAL_TRIGGER_NODE_TYPES.includes(node.type)) ??
			startableTriggers[0];
		if (!trigger) {
			throw new BadRequestError(
				'This workflow has no trigger that can be started manually (webhook triggers need an external call). Open it in the editor to run it.',
			);
		}

		const workflowData: IWorkflowBase = {
			...workflow,
			nodes,
			connections,
			versionId,
			active: false,
			activeVersionId: null,
			pinData: undefined,
			settings: { ...workflow.settings, saveManualExecutions: true },
		};

		const { projectId, projectName } = await getWorkflowProjectDetailsSafe(
			this.ownershipService,
			workflow.id,
		);

		const data: IWorkflowExecutionDataProcess = {
			executionMode: 'manual',
			workflowData,
			userId: user.id,
			pushRef,
			triggerToStartFrom: { name: trigger.name },
			projectId,
			projectName,
			encryptedRunnerIdentity: n8nAuthCookie
				? await this.executionContextService.buildManualExecutionCredentials(n8nAuthCookie)
				: undefined,
		};

		const executionId = await this.workflowRunner.run(data);
		return { executionId, projectId, projectName };
	}

	// ----------------------------------
	//          who ran an execution
	// ----------------------------------

	async recordActor(executionId: string, userId: string) {
		if (!(await this.settings.isEnabled('executionTracking'))) return;
		const id = Number(executionId);
		if (!Number.isInteger(id)) return;
		await this.actorRepository.upsert({ executionId: id, userId }, ['executionId']);
	}

	async findActors(executionIds: number[]): Promise<Map<number, string>> {
		if (executionIds.length === 0) return new Map();
		const rows = await this.actorRepository
			.createQueryBuilder('actor')
			.where('actor.executionId IN (:...executionIds)', { executionIds })
			.getMany();
		return new Map(rows.map((row) => [row.executionId, row.userId]));
	}

	// ----------------------------------
	//               helpers
	// ----------------------------------

	private async assertEnabled(feature: ExtrasFeature) {
		if (!(await this.settings.isEnabled(feature))) {
			throw new ForbiddenError(`The "${feature}" plugin feature is switched off`);
		}
	}

	private async getPublishedWorkflow(workflowId: string) {
		const workflow = await this.workflowRepository.findOne({
			where: { id: workflowId },
			select: { id: true, activeVersionId: true },
		});
		if (!workflow) throw new NotFoundError(`Workflow with ID "${workflowId}" not found`);
		if (workflow.activeVersionId === null) {
			throw new BadRequestError('Only published workflows can be paused or resumed');
		}
		return workflow;
	}
}
