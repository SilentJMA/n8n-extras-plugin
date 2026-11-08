import { defineConfig, globalIgnores } from 'eslint/config';
import { frontendConfig } from '@n8n/eslint-config/frontend';

export default defineConfig(
	frontendConfig,
	// A copy of the Data Mapper node's engine, kept identical to the node (see engine/index.ts).
	globalIgnores(['src/components/dataMapper/engine/']),
);
