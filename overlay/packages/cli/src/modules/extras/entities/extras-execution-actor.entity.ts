import { BaseEntity, Column, Entity, Index, PrimaryColumn } from '@n8n/typeorm';

/** Who started a manual execution. Deleted together with the execution. */
@Entity({ name: 'extras_execution_actor' })
export class ExtrasExecutionActor extends BaseEntity {
	@PrimaryColumn({ type: 'int' })
	executionId: number;

	@Index()
	@Column({ type: 'varchar', length: 36 })
	userId: string;
}
