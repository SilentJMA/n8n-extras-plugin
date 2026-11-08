import { createComponentRenderer } from '@n8n/frontend-test-utils';
import userEvent from '@testing-library/user-event';
import { createPinia, setActivePinia } from 'pinia';

import { useExtrasStore } from '../../extras.store';
import DataMapperParameter from './DataMapperParameter.vue';
import { readMapDefinition } from './dataMapper.utils';

vi.mock('../../extras.api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../extras.api')>()),
	fetchState: vi.fn().mockReturnValue(new Promise(() => {})),
}));
vi.mock('@n8n/stores/useRootStore', () => ({
	useRootStore: () => ({ restApiContext: { baseUrl: '/rest' } }),
}));

const parameter = {
	displayName: 'Visual Mapping',
	name: 'visualMapping',
	type: 'json' as const,
	default: '',
	typeOptions: {
		extensionComponent: 'extras.dataMapper',
		dataMapper: {
			sourceProfileParameter: 'sourceProfile',
			sourceFormatParameter: 'sourceProfileFormat',
			targetProfileParameter: 'targetProfile',
			targetFormatParameter: 'targetProfileFormat',
		},
	},
};

const node = {
	id: 'n1',
	name: 'Data Mapper',
	type: 'CUSTOM.dataMapper',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {
		sourceProfile: JSON.stringify({ order: { id: 'A1', customerName: 'Ann' } }),
		sourceProfileFormat: 'auto',
		targetProfile: JSON.stringify({ Order: { Id: '', CustomerName: '' } }),
		targetProfileFormat: 'auto',
	},
};

const stored = JSON.stringify({
	mappings: [{ source: 'order.id', target: 'Order.Id' }],
	functions: [],
});

const renderComponent = createComponentRenderer(DataMapperParameter);

describe('DataMapperParameter', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('shows the source and target fields of the profiles', () => {
		const { getAllByTestId, getByText } = renderComponent({
			props: { parameter, node, path: 'parameters.visualMapping', value: stored },
		});

		expect(getAllByTestId('data-mapper-source-row').length).toBeGreaterThan(0);
		expect(getByText('customerName')).toBeInTheDocument();
		expect(getByText('CustomerName')).toBeInTheDocument();
		expect(getByText('1 mapping')).toBeInTheDocument();
	});

	it('emits the definition as JSON text after an edit', async () => {
		const { getByTestId, emitted } = renderComponent({
			props: { parameter, node, path: 'parameters.visualMapping', value: stored },
		});

		await userEvent.click(getByTestId('data-mapper-auto-map'));

		const events = emitted<Array<{ name: string; node: string; value: string }>>('valueChanged');
		const last = events?.at(-1)?.[0];
		expect(last?.name).toBe('parameters.visualMapping');
		expect(typeof last?.value).toBe('string');
		const definition = readMapDefinition(last?.value);
		expect(definition.mappings.map((m) => m.target)).toEqual(['Order.Id', 'Order.CustomerName']);
	});

	it('uses the first input item as the source without a source profile', () => {
		const { getByText } = renderComponent({
			props: {
				parameter,
				node: { ...node, parameters: { ...node.parameters, sourceProfile: '' } },
				path: 'parameters.visualMapping',
				value: stored,
				inputItems: [{ json: { shop: { orderNumber: 'X' } } }],
			},
		});

		expect(getByText('orderNumber')).toBeInTheDocument();
	});

	it('shows the JSON text when the feature is switched off', () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		useExtrasStore().features.visualDataMapper = false;

		const { getByTestId, queryByTestId } = renderComponent({
			pinia,
			props: { parameter, node, path: 'parameters.visualMapping', value: stored },
		});

		expect(queryByTestId('data-mapper-source-tree')).toBeNull();
		expect(getByTestId('data-mapper-json')).toBeInTheDocument();
	});
});
