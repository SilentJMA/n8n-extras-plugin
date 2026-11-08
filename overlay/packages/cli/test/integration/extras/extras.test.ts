import {
	createActiveWorkflow,
	createWorkflow,
	testDb,
	mockInstance,
} from '@n8n/backend-test-utils';
import type { User } from '@n8n/db';
import { WorkflowRepository } from '@n8n/db';
import { Container } from '@n8n/di';

import { ConcurrencyControlService } from '@/concurrency/concurrency-control.service';
import { ExtrasSettingsService } from '@/modules/extras/extras-settings.service';
import {
	ExtrasExecutionActorRepository,
	ExtrasSettingRepository,
	ExtrasWorkflowPauseRepository,
} from '@/modules/extras/extras.repositories';
import { ExtrasService } from '@/modules/extras/extras.service';
import { PublicationSuppression } from '@/workflows/publication/publication-suppression';
import { WaitTracker } from '@/wait-tracker';

import { createExecution } from '../shared/db/executions';
import { createMember, createOwner } from '../shared/db/users';
import { setupTestServer } from '../shared/utils';

mockInstance(WaitTracker);
mockInstance(ConcurrencyControlService, {
	// @ts-expect-error Private property
	isEnabled: false,
});

const testServer = setupTestServer({
	endpointGroups: ['executions', 'workflows'],
	modules: ['extras'],
});

let owner: User;
let member: User;

const createPublishedWorkflow = async () => await createActiveWorkflow({}, owner);

beforeEach(async () => {
	await testDb.truncate(['ExecutionEntity', 'WorkflowEntity', 'SharedWorkflow']);
	await Container.get(ExtrasWorkflowPauseRepository).delete({});
	await Container.get(ExtrasExecutionActorRepository).delete({});
	await Container.get(ExtrasSettingRepository).delete({});
	Container.get(ExtrasSettingsService).resetCache();
	owner = await createOwner();
	member = await createMember();
});

describe('GET /extras/state', () => {
	test('returns every feature switched on by default', async () => {
		const response = await testServer.authAgentFor(member).get('/extras/state').expect(200);

		expect(response.body.data).toEqual({
			features: {
				publishedTab: true,
				folderExpand: true,
				executeFromList: true,
				pauseResume: true,
				executionTracking: true,
				visualDataMapper: true,
			},
			pausedWorkflowIds: [],
		});
	});
});

describe('PATCH /extras/settings', () => {
	test('lets an admin switch a feature off, and reads it back', async () => {
		await testServer
			.authAgentFor(owner)
			.patch('/extras/settings')
			.send({ features: { folderExpand: false } })
			.expect(200);

		const state = await testServer.authAgentFor(member).get('/extras/state').expect(200);
		expect(state.body.data.features.folderExpand).toBe(false);
		expect(state.body.data.features.pauseResume).toBe(true);
	});

	test('rejects unknown features', async () => {
		await testServer
			.authAgentFor(owner)
			.patch('/extras/settings')
			.send({ features: { nope: true } })
			.expect(400);
	});

	test('forbids non-admins', async () => {
		await testServer
			.authAgentFor(member)
			.patch('/extras/settings')
			.send({ features: { folderExpand: false } })
			.expect(403);
	});
});

describe('pause and resume', () => {
	test('pauses a published workflow, keeps it published, and suppresses it', async () => {
		const workflow = await createPublishedWorkflow();

		const response = await testServer
			.authAgentFor(owner)
			.post(`/extras/workflows/${workflow.id}/pause`)
			.expect(200);
		expect(response.body.data).toEqual({ id: workflow.id, paused: true });

		const stored = await Container.get(WorkflowRepository).findOneByOrFail({ id: workflow.id });
		expect(stored.activeVersionId).toBe(workflow.versionId);

		const state = await testServer.authAgentFor(owner).get('/extras/state').expect(200);
		expect(state.body.data.pausedWorkflowIds).toEqual([workflow.id]);
		expect(await Container.get(PublicationSuppression).isSuppressed(workflow.id)).toBe(true);
	});

	test('resume clears the pause', async () => {
		const workflow = await createPublishedWorkflow();
		await testServer.authAgentFor(owner).post(`/extras/workflows/${workflow.id}/pause`).expect(200);

		const response = await testServer
			.authAgentFor(owner)
			.post(`/extras/workflows/${workflow.id}/resume`)
			.expect(200);

		expect(response.body.data).toEqual({ id: workflow.id, paused: false });
		expect(await Container.get(PublicationSuppression).isSuppressed(workflow.id)).toBe(false);
	});

	test('rejects pausing a workflow that is not published', async () => {
		const workflow = await createWorkflow({}, owner);

		await testServer.authAgentFor(owner).post(`/extras/workflows/${workflow.id}/pause`).expect(400);
	});

	test('is refused when the feature is switched off', async () => {
		const workflow = await createPublishedWorkflow();
		await testServer
			.authAgentFor(owner)
			.patch('/extras/settings')
			.send({ features: { pauseResume: false } })
			.expect(200);

		await testServer.authAgentFor(owner).post(`/extras/workflows/${workflow.id}/pause`).expect(403);
	});
});

describe('execute a published workflow', () => {
	test('rejects a workflow that is not published', async () => {
		const workflow = await createWorkflow({}, owner);

		await testServer
			.authAgentFor(owner)
			.post(`/extras/workflows/${workflow.id}/execute`)
			.expect(400);
	});
});

describe('who ran an execution', () => {
	test('filters by run type and by user, and reports the user in the summary', async () => {
		const workflow = await createWorkflow({}, owner);
		const byOwner = await createExecution({ mode: 'manual' }, workflow);
		const byMember = await createExecution({ mode: 'manual' }, workflow);
		const automatic = await createExecution({ mode: 'trigger' }, workflow);

		const extras = Container.get(ExtrasService);
		await extras.recordActor(byOwner.id, owner.id);
		await extras.recordActor(byMember.id, member.id);

		const idsFor = async (ext: object) => {
			const response = await testServer
				.authAgentFor(owner)
				.get('/executions')
				.query({ filter: JSON.stringify({ ext }) })
				.expect(200);
			const { results } = response.body.data as { results: Array<{ id: string }> };
			return results.map(({ id }) => id).sort();
		};

		expect(await idsFor({ manualExecution: true })).toEqual([byOwner.id, byMember.id].sort());
		expect(await idsFor({ manualExecution: false })).toEqual([automatic.id]);
		expect(await idsFor({ executedByUserId: member.id })).toEqual([byMember.id]);

		const response = await testServer
			.authAgentFor(owner)
			.get('/executions')
			.query({ filter: JSON.stringify({ ext: { executedByUserId: owner.id } }) })
			.expect(200);
		expect(response.body.data.results[0].ext).toEqual({ executedByUserId: owner.id });
	});

	test('records nothing when execution tracking is switched off', async () => {
		await testServer
			.authAgentFor(owner)
			.patch('/extras/settings')
			.send({ features: { executionTracking: false } })
			.expect(200);
		const workflow = await createWorkflow({}, owner);
		const execution = await createExecution({ mode: 'manual' }, workflow);

		await Container.get(ExtrasService).recordActor(execution.id, owner.id);

		expect((await Container.get(ExtrasService).findActors([Number(execution.id)])).size).toBe(0);
	});
});
