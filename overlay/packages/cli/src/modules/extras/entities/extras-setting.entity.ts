import { BaseEntity, Column, Entity, PrimaryColumn } from '@n8n/typeorm';

@Entity({ name: 'extras_setting' })
export class ExtrasSetting extends BaseEntity {
	@PrimaryColumn({ type: 'varchar', length: 64 })
	key: string;

	@Column({ type: 'text' })
	value: string;
}
