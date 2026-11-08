import { defineComponent } from 'vue';

import { clear, get, getParameterInput, registerAll } from './uiExtensionRegistry';

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

	it('finds a parameter input by name across modules', () => {
		const Other = defineComponent({ render: () => null });

		registerAll({ parameterInputs: { 'first.input': Stub } });
		registerAll({ parameterInputs: { 'second.input': Other } });

		expect(getParameterInput('first.input')).toBe(Stub);
		expect(getParameterInput('second.input')).toBe(Other);
	});

	it('has no parameter input for an unknown or inherited name', () => {
		registerAll({ parameterInputs: { known: Stub } });

		expect(getParameterInput('unknown')).toBeUndefined();
		expect(getParameterInput('constructor')).toBeUndefined();
	});
});
