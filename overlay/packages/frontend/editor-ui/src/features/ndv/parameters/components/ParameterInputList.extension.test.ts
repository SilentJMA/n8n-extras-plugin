import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore, getTooltip, hoverTooltipTrigger } from '@/__tests__/utils';
import ParameterInputList from './ParameterInputList.vue';
import { uiExtensionRegistry } from '@n8n/frontend-module-sdk';
import { defineComponent, h } from 'vue';
import { createTestingPinia } from '@pinia/testing';
import { fireEvent, waitFor } from '@testing-library/vue';
import { useNDVStore } from '@/features/ndv/shared/ndv.store';
import * as workflowHelpers from '@/app/composables/useWorkflowHelpers';
import { flushPromises } from '@vue/test-utils';
import { nextTick, ref, shallowRef } from 'vue';
import {
	injectWorkflowDocumentStore,
	useWorkflowDocumentStore,
	createWorkflowDocumentId,
} from '@/app/stores/workflowDocument.store';

vi.mock('@/app/stores/workflowDocument.store', async (importOriginal) => ({
	...(await importOriginal()),
	injectWorkflowDocumentStore: vi.fn(),
	useWorkflowDocumentStore: vi.fn().mockReturnValue({
		name: '',
		settings: {},
		getPinDataSnapshot: () => ({}),
		workflowTriggerNodes: [],
		allNodes: [],
	}),
}));

// Mock i18n to return translation keys instead of translated strings
vi.mock('@n8n/i18n', () => {
	const i18n = {
		baseText: (key: string) => key,
		nodeText: () => ({
			inputLabelDisplayName: (parameter: { displayName: string }) => parameter.displayName,
			inputLabelDescription: (parameter: { description?: string }) => parameter.description,
			placeholder: (parameter: { placeholder?: string }) => parameter.placeholder,
			hint: (parameter: { hint?: string }) => parameter.hint,
			optionsOptionName: (parameter: { name: string }) => parameter.name,
			optionsOptionDescription: (parameter: { description?: string }) => parameter.description,
			collectionOptionName: (parameter: { displayName: string }) => parameter.displayName,
			credentialsSelectAuthDisplayName: (parameter: { displayName: string }) =>
				parameter.displayName,
			credentialsSelectAuthDescription: (parameter: { description?: string }) =>
				parameter.description,
		}),
	};

	return {
		useI18n: () => i18n,
		i18n,
		i18nInstance: {
			install: vi.fn(),
		},
	};
});

import {
	TEST_NODE_NO_ISSUES,
	TEST_PARAMETERS,
	TEST_NODE_VALUES,
	TEST_NODE_WITH_ISSUES,
	FIXED_COLLECTION_PARAMETERS,
} from './ParameterInputList.test.constants';
import { FORM_NODE_TYPE, FORM_TRIGGER_NODE_TYPE } from 'n8n-workflow';
import type { INode, INodeProperties } from 'n8n-workflow';
import type { INodeUi } from '@/Interface';
import type { MockInstance } from 'vitest';
import { WAIT_NODE_TYPE, AGENT_NODE_TYPE } from '@/app/constants';
import { useAiGateway } from '@/app/composables/useAiGateway';

const mockConfirm = vi.fn();
vi.mock('@/app/composables/useMessage', () => ({
	useMessage: () => ({
		confirm: mockConfirm,
		alert: vi.fn(),
		message: vi.fn(),
	}),
}));

vi.mock('@n8n/rest-api-client/api/users', () => ({
	updateCurrentUserSettings: vi.fn(),
}));

vi.mock('@/app/composables/useAiGateway', () => ({
	useAiGateway: vi.fn(() => ({
		isEnabled: { value: false },
		isCredentialTypeSupported: vi.fn(() => false),
		canServeCredentialType: vi.fn(() => false),
		isActionSupported: vi.fn(() => true),
		isActionOptionVisible: vi.fn(() => true),
		isNodePropertyHidden: vi.fn(() => false),
		balance: { value: undefined },
		budget: { value: undefined },
		creditsLabelKey: { value: 'generic.freeCredits' },
		fetchError: { value: null },
		fetchConfig: vi.fn(),
		fetchWallet: vi.fn(),
		saveAfterToggle: vi.fn(),
	})),
}));

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');
	return {
		...actual,
		useRouter: () => ({
			push: vi.fn(),
		}),
		useRoute: () => ({
			params: {},
			location: {},
			query: {},
		}),
	};
});

let ndvStore: ReturnType<typeof mockedStore<typeof useNDVStore>>;

const workflowDocumentStoreMock = {
	documentId: createWorkflowDocumentId(''),
	getChildNodes: vi.fn().mockReturnValue([]),
	getParentNodes: vi.fn().mockReturnValue([]),
	getParentNodesByDepth: vi.fn().mockReturnValue([]),
	getNodeByName: vi.fn().mockReturnValue(undefined),
	checkIfNodeHasChatOrManualChatParent: vi.fn().mockReturnValue(false),
	name: '',
	settings: {},
	getPinDataSnapshot: vi.fn().mockReturnValue({}),
	workflowTriggerNodes: [],
	allNodes: [],
};

const renderComponent = createComponentRenderer(ParameterInputList, {
	props: {
		hideDelete: true,
		indent: true,
		isReadOnly: false,
	},
	global: {
		stubs: {
			ParameterInputFull: { template: '<div data-test-id="parameter-input"></div>' },
			Suspense: { template: '<div data-test-id="suspense-stub"><slot></slot></div>' },
		},
	},
});

// A parameter that names a module component in `typeOptions.extensionComponent`.
const EXTENSION_PARAMETER: INodeProperties = {
	displayName: 'Drawn by a module',
	name: 'drawn',
	type: 'json',
	default: '{}',
	typeOptions: { extensionComponent: 'test.input' },
};

const Drawn = defineComponent({
	props: {
		parameter: { type: Object, required: true },
		value: { type: [String, Object], default: undefined },
		path: { type: String, required: true },
		node: { type: Object, default: null },
		isReadOnly: Boolean,
		inputItems: { type: Array, default: () => [] },
	},
	emits: ['valueChanged'],
	render() {
		return h(
			'button',
			{
				'data-test-id': 'module-input',
				onClick: () =>
					this.$emit('valueChanged', { name: this.path, node: 'Test', value: '{"a":1}' }),
			},
			`${this.path}=${String(this.value)}:${this.inputItems.length}`,
		);
	},
});

describe('ParameterInputList module parameter inputs', () => {
	beforeEach(() => {
		createTestingPinia();
		ndvStore = mockedStore(useNDVStore, createWorkflowDocumentId(''));
		vi.mocked(injectWorkflowDocumentStore).mockReturnValue(
			shallowRef(workflowDocumentStoreMock) as unknown as ReturnType<
				typeof injectWorkflowDocumentStore
			>,
		);
		vi.mocked(useWorkflowDocumentStore).mockReturnValue(
			workflowDocumentStoreMock as unknown as ReturnType<typeof useWorkflowDocumentStore>,
		);
		uiExtensionRegistry.clear();
	});

	afterEach(async () => {
		uiExtensionRegistry.clear();
		await flushPromises();
	});

	it('draws the parameter with the module component and passes its changes on', async () => {
		uiExtensionRegistry.registerAll({ parameterInputs: { 'test.input': Drawn } });
		ndvStore.activeNode = TEST_NODE_NO_ISSUES;
		const { getByTestId, queryByTestId, emitted } = renderComponent({
			props: {
				parameters: [EXTENSION_PARAMETER],
				nodeValues: { parameters: { drawn: '{"b":2}' } },
				path: 'parameters',
			},
		});
		await flushPromises();

		const input = getByTestId('module-input');
		expect(input.textContent).toBe('parameters.drawn={"b":2}:0');
		expect(queryByTestId('parameter-input')).toBeNull();

		await fireEvent.click(input);
		expect(emitted('valueChanged')?.[0]).toEqual([
			{ name: 'parameters.drawn', node: 'Test', value: '{"a":1}' },
		]);
	});

	it('draws the default input when no module provides the component', async () => {
		ndvStore.activeNode = TEST_NODE_NO_ISSUES;
		const { getByTestId, queryByTestId } = renderComponent({
			props: {
				parameters: [EXTENSION_PARAMETER],
				nodeValues: { parameters: { drawn: '{}' } },
				path: 'parameters',
			},
		});
		await flushPromises();

		expect(queryByTestId('module-input')).toBeNull();
		expect(getByTestId('parameter-input')).toBeInTheDocument();
	});
});
