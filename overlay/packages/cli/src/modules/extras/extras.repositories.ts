import { DataSource, Repository } from '@n8n/typeorm';
import { Service } from '@n8n/di';

import { ExtrasExecutionActor } from './entities/extras-execution-actor.entity';
import { ExtrasSetting } from './entities/extras-setting.entity';
import { ExtrasWorkflowPause } from './entities/extras-workflow-pause.entity';

@Service()
export class ExtrasWorkflowPauseRepository extends Repository<ExtrasWorkflowPause> {
	constructor(dataSource: DataSource) {
		super(ExtrasWorkflowPause, dataSource.manager);
	}
}

@Service()
export class ExtrasExecutionActorRepository extends Repository<ExtrasExecutionActor> {
	constructor(dataSource: DataSource) {
		super(ExtrasExecutionActor, dataSource.manager);
	}
}

@Service()
export class ExtrasSettingRepository extends Repository<ExtrasSetting> {
	constructor(dataSource: DataSource) {
		super(ExtrasSetting, dataSource.manager);
	}
}
