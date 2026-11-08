import { Service } from '@n8n/di';
import type { SelectQueryBuilder } from '@n8n/typeorm';
import type { ExecutionSummary } from 'n8n-workflow';

import type { ExecutionEntity } from '../entities';

/**
 * Lets a module extend the executions list without editing the repository.
 *
 * Extra filters travel in the single `ext` filter key (`{ ext: { ... } }`), so the
 * core filter schema stays closed. An extension reads only the keys it owns.
 */
export interface ExecutionQueryExtension {
	/** Add WHERE/JOIN clauses for the extension's own keys in `ext`. The table alias is `execution`. */
	applyFilters?(qb: SelectQueryBuilder<ExecutionEntity>, ext: Record<string, unknown>): void;
	/** Add fields to the summaries of a returned page. Mutates in place. */
	enrich?(summaries: ExecutionSummary[]): Promise<void>;
}

@Service()
export class ExecutionQueryExtensions {
	private readonly extensions = new Set<ExecutionQueryExtension>();

	register(extension: ExecutionQueryExtension) {
		this.extensions.add(extension);
	}

	unregister(extension: ExecutionQueryExtension) {
		this.extensions.delete(extension);
	}

	applyFilters(qb: SelectQueryBuilder<ExecutionEntity>, ext?: Record<string, unknown>) {
		if (!ext) return;
		for (const extension of this.extensions) extension.applyFilters?.(qb, ext);
	}

	async enrich(summaries: ExecutionSummary[]) {
		if (summaries.length === 0) return;
		for (const extension of this.extensions) await extension.enrich?.(summaries);
	}
}
