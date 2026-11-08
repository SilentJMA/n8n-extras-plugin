// Copied from the Data Mapper node (nodes/DataMapper in the plugin repository), so the editor reads
// profiles and builds definitions exactly like the node. Refresh with scripts/sync-data-mapper-engine.sh.
export * from './tree';
export * from './function-catalog';
export type { FieldType, ProfileField, ProfileFormat } from './profile';
export type { IfMissing, LookupFallback, MappingRule, Transform } from './mapping';
