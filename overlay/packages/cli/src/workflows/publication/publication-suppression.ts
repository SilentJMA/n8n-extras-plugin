import { Service } from '@n8n/di';

/** Returns the ids of workflows whose triggers must not run right now. */
export type SuppressedWorkflowIdsProvider = () => Promise<string[]>;

/**
 * Lets a module keep a published workflow's triggers and webhooks switched off
 * without unpublishing it (for example, a "pause" feature).
 *
 * A suppressed workflow keeps its `activeVersionId`. The publication applier,
 * the reconciler and startup activation all treat it as not running.
 */
@Service()
export class PublicationSuppression {
	private readonly providers = new Set<SuppressedWorkflowIdsProvider>();

	register(provider: SuppressedWorkflowIdsProvider) {
		this.providers.add(provider);
	}

	unregister(provider: SuppressedWorkflowIdsProvider) {
		this.providers.delete(provider);
	}

	async suppressedIds(): Promise<Set<string>> {
		const ids = new Set<string>();
		for (const provider of this.providers) {
			for (const id of await provider()) ids.add(id);
		}
		return ids;
	}

	async isSuppressed(workflowId: string): Promise<boolean> {
		if (this.providers.size === 0) return false;
		return (await this.suppressedIds()).has(workflowId);
	}
}
