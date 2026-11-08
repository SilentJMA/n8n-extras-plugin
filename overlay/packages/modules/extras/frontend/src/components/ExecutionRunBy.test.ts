import { createComponentRenderer } from '@n8n/frontend-test-utils';
import { createPinia, setActivePinia } from 'pinia';

import { useExtrasStore } from '../extras.store';
import ExecutionRunBy from './ExecutionRunBy.vue';

vi.mock('@n8n/stores/users.store', () => ({
	useUsersStore: () => ({
		allUsers: [],
		usersById: { 'user-1': { id: 'user-1', fullName: 'Ada Lovelace' } },
	}),
}));

const renderComponent = createComponentRenderer(ExecutionRunBy);

describe('ExecutionRunBy', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('shows who started a manual execution', () => {
		const { getByTestId } = renderComponent({
			props: { execution: { id: '1', mode: 'manual', ext: { executedByUserId: 'user-1' } } },
		});

		expect(getByTestId('extras-execution-run-by')).toHaveTextContent('Ada Lovelace');
	});

	it('shows nothing for an automatic execution', () => {
		const { queryByTestId } = renderComponent({
			props: { execution: { id: '2', mode: 'trigger', ext: { executedByUserId: 'user-1' } } },
		});

		expect(queryByTestId('extras-execution-run-by')).toBeNull();
	});

	it('shows nothing when execution tracking is switched off', () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		useExtrasStore().features.executionTracking = false;

		const { queryByTestId } = renderComponent({
			pinia,
			props: { execution: { id: '1', mode: 'manual', ext: { executedByUserId: 'user-1' } } },
		});

		expect(queryByTestId('extras-execution-run-by')).toBeNull();
	});
});
