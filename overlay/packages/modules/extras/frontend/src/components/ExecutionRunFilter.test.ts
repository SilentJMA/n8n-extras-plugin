import { createComponentRenderer } from '@n8n/frontend-test-utils';
import { createPinia, setActivePinia } from 'pinia';

import { useExtrasStore } from '../extras.store';
import ExecutionRunFilter from './ExecutionRunFilter.vue';

vi.mock('@n8n/stores/users.store', () => ({
	useUsersStore: () => ({
		allUsers: [{ id: 'user-1', fullName: 'Ada Lovelace' }],
		usersById: {},
	}),
}));

const renderComponent = createComponentRenderer(ExecutionRunFilter);

describe('ExecutionRunFilter', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('renders the run type and run by fields', () => {
		const { getByTestId } = renderComponent({ props: { modelValue: {} } });

		expect(getByTestId('extras-execution-filter')).toBeVisible();
		expect(getByTestId('extras-filter-run-type')).toBeInTheDocument();
		expect(getByTestId('extras-filter-run-by')).toBeInTheDocument();
	});

	it('renders nothing when execution tracking is switched off', () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		useExtrasStore().features.executionTracking = false;

		const { queryByTestId } = renderComponent({ pinia, props: { modelValue: {} } });

		expect(queryByTestId('extras-execution-filter')).toBeNull();
	});
});
