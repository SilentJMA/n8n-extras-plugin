import type { ExecutionEntity, ExecutionQueryExtension } from '@n8n/db';
import { Container } from '@n8n/di';
import type { SelectQueryBuilder } from '@n8n/typeorm';
import type { ExecutionSummary } from 'n8n-workflow';

import { ExtrasExecutionActor } from './entities/extras-execution-actor.entity';
import { ExtrasService } from './extras.service';

/** Adds the "manual run" and "run by" filters and the `ext.executedByUserId` summary field. */
export const extrasExecutionQueryExtension: ExecutionQueryExtension = {
	applyFilters(qb: SelectQueryBuilder<ExecutionEntity>, ext) {
		if (typeof ext.manualExecution === 'boolean') {
			qb.andWhere(
				ext.manualExecution ? 'execution.mode = :extrasManual' : 'execution.mode != :extrasManual',
				{
					extrasManual: 'manual',
				},
			);
		}

		if (typeof ext.executedByUserId === 'string' && ext.executedByUserId.length > 0) {
			const actors = qb
				.subQuery()
				.select('1')
				.from(ExtrasExecutionActor, 'extrasActor')
				.where('extrasActor.executionId = execution.id')
				.andWhere('extrasActor.userId = :extrasUserId')
				.getQuery();
			qb.andWhere(`EXISTS ${actors}`, { extrasUserId: ext.executedByUserId });
		}
	},

	async enrich(summaries: ExecutionSummary[]) {
		const manual = summaries.filter((summary) => summary.mode === 'manual');
		const actors = await Container.get(ExtrasService).findActors(
			manual.map((summary) => Number(summary.id)).filter(Number.isInteger),
		);
		for (const summary of manual) {
			const userId = actors.get(Number(summary.id));
			if (userId) summary.ext = { ...summary.ext, executedByUserId: userId };
		}
	},
};
