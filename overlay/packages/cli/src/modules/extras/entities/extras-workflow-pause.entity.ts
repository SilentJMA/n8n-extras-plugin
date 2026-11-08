import { BaseEntity, Column, Entity, PrimaryColumn } from '@n8n/typeorm';

/** A published workflow whose triggers and webhooks are switched off. */
@Entity({ name: 'extras_workflow_pause' })
export class ExtrasWorkflowPause extends BaseEntity {
	@PrimaryColumn({ type: 'varchar', length: 36 })
	workflowId: string;

	@Column({ type: 'varchar', length: 36, nullable: true })
	pausedByUserId: string | null;
}
