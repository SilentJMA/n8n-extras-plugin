import { getFullApiResponse, makeRestApiRequest, type IRestApiContext } from '@n8n/rest-api-client';

export type ExtrasFeatures = {
	publishedTab: boolean;
	folderExpand: boolean;
	executeFromList: boolean;
	pauseResume: boolean;
	executionTracking: boolean;
};

export type ExtrasState = {
	features: ExtrasFeatures;
	pausedWorkflowIds: string[];
};

export const DEFAULT_FEATURES: ExtrasFeatures = {
	publishedTab: true,
	folderExpand: true,
	executeFromList: true,
	pauseResume: true,
	executionTracking: true,
};

export async function fetchState(context: IRestApiContext) {
	return await makeRestApiRequest<ExtrasState>(context, 'GET', '/extras/state');
}

export async function saveFeatures(context: IRestApiContext, features: Partial<ExtrasFeatures>) {
	return await makeRestApiRequest<{ features: ExtrasFeatures }>(
		context,
		'PATCH',
		'/extras/settings',
		{
			features,
		},
	);
}

export async function pauseWorkflow(context: IRestApiContext, workflowId: string) {
	return await makeRestApiRequest<{ id: string; paused: boolean }>(
		context,
		'POST',
		`/extras/workflows/${workflowId}/pause`,
	);
}

export async function resumeWorkflow(context: IRestApiContext, workflowId: string) {
	return await makeRestApiRequest<{ id: string; paused: boolean }>(
		context,
		'POST',
		`/extras/workflows/${workflowId}/resume`,
	);
}

export async function executeWorkflow(context: IRestApiContext, workflowId: string) {
	return await makeRestApiRequest<{ executionId: string }>(
		context,
		'POST',
		`/extras/workflows/${workflowId}/execute`,
	);
}

export type FolderWorkflow = {
	id: string;
	name: string;
	activeVersionId: string | null;
};

/** Workflows directly inside a folder, by name. */
export async function fetchFolderWorkflows(
	context: IRestApiContext,
	params: { folderId: string; projectId?: string; publishedOnly: boolean },
) {
	const response = await getFullApiResponse<Array<FolderWorkflow & { resource?: string }>>(
		context,
		'GET',
		'/workflows',
		{
			filter: {
				...(params.projectId ? { projectId: params.projectId } : {}),
				parentFolderId: params.folderId,
				isArchived: false,
				...(params.publishedOnly ? { active: true } : {}),
			},
			skip: 0,
			take: 100,
			sortBy: 'name:asc',
		},
	);
	return response.data.filter((item) => item.resource !== 'folder');
}
