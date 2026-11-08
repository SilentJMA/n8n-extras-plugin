import { Service } from '@n8n/di';

import { DEFAULT_EXTRAS_FEATURES, EXTRAS_FEATURES, type ExtrasFeatures } from './extras.constants';
import { ExtrasSettingRepository } from './extras.repositories';

const FEATURES_KEY = 'features';

@Service()
export class ExtrasSettingsService {
	private cache: ExtrasFeatures | undefined;

	constructor(private readonly settingRepository: ExtrasSettingRepository) {}

	/** Drops the in-memory copy so the next read goes to the database (used by tests). */
	resetCache() {
		this.cache = undefined;
	}

	async getFeatures(): Promise<ExtrasFeatures> {
		if (this.cache) return this.cache;

		const row = await this.settingRepository.findOneBy({ key: FEATURES_KEY });
		let stored: Partial<ExtrasFeatures> = {};
		try {
			stored = row ? (JSON.parse(row.value) as Partial<ExtrasFeatures>) : {};
		} catch {
			// A corrupt value falls back to the defaults.
		}

		this.cache = { ...DEFAULT_EXTRAS_FEATURES, ...this.onlyKnownBooleans(stored) };
		return this.cache;
	}

	async updateFeatures(update: Partial<ExtrasFeatures>): Promise<ExtrasFeatures> {
		const next = { ...(await this.getFeatures()), ...this.onlyKnownBooleans(update) };
		await this.settingRepository.save({ key: FEATURES_KEY, value: JSON.stringify(next) });
		this.cache = next;
		return next;
	}

	async isEnabled(feature: keyof ExtrasFeatures): Promise<boolean> {
		return (await this.getFeatures())[feature];
	}

	private onlyKnownBooleans(input: Partial<ExtrasFeatures>): Partial<ExtrasFeatures> {
		const result: Partial<ExtrasFeatures> = {};
		for (const feature of EXTRAS_FEATURES) {
			if (typeof input[feature] === 'boolean') result[feature] = input[feature];
		}
		return result;
	}
}
