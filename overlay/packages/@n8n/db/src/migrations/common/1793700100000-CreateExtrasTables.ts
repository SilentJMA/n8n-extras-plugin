import type { MigrationContext, ReversibleMigration } from '../migration-types';

const pauseTable = 'extras_workflow_pause';
const actorTable = 'extras_execution_actor';
const settingTable = 'extras_setting';

/** Tables owned by the optional "extras" module. */
export class CreateExtrasTables1793700100000 implements ReversibleMigration {
	async up({ schemaBuilder: { createTable, column } }: MigrationContext) {
		await createTable(pauseTable)
			.withColumns(
				column('workflowId').varchar(36).primary.notNull,
				column('pausedByUserId').varchar(36),
			)
			.withForeignKey('workflowId', {
				tableName: 'workflow_entity',
				columnName: 'id',
				onDelete: 'CASCADE',
			});

		await createTable(actorTable)
			.withColumns(column('executionId').int.primary.notNull, column('userId').varchar(36).notNull)
			.withIndexOn('userId')
			.withForeignKey('executionId', {
				tableName: 'execution_entity',
				columnName: 'id',
				onDelete: 'CASCADE',
			});

		await createTable(settingTable).withColumns(
			column('key').varchar(64).primary.notNull,
			column('value').text.notNull,
		);
	}

	async down({ schemaBuilder: { dropTable } }: MigrationContext) {
		await dropTable(settingTable);
		await dropTable(actorTable);
		await dropTable(pauseTable);
	}
}
