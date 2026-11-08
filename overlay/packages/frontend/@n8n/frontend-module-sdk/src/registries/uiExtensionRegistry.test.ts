import { defineComponent } from 'vue';

import { clear, get, registerAll } from './uiExtensionRegistry';

const Stub = defineComponent({ render: () => null });

describe('uiExtensionRegistry', () => {
	beforeEach(() => clear());

	it('starts with every slot empty', () => {
		expect(get('workflowCardActions')).toEqual([]);
		expect(get('folderCardToggle')).toEqual([]);
		expect(get('executionRowCells')).toEqual([]);
	});

	it('flattens single components and lists into the same slot', () => {
		const Other = defineComponent({ render: () => null });

		registerAll({ folderCardToggle: Stub, executionRowCells: [Stub, Other] });

		expect(get('folderCardToggle')).toEqual([Stub]);
		expect(get('executionRowCells')).toEqual([Stub, Other]);
	});

	it('adds to what earlier modules contributed', () => {
		registerAll({ workflowCardActions: [Stub] });
		registerAll({ workflowCardActions: [Stub] });

		expect(get('workflowCardActions')).toHaveLength(2);
	});

	it('does not store the components as reactive objects', () => {
		registerAll({ folderCardToggle: Stub });

		expect(get('folderCardToggle')[0]).toBe(Stub);
	});
});
