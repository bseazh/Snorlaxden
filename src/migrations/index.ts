import * as migration_20261024_113020_sprint1_content from './20261024_113020_sprint1_content';
import * as migration_20261024_124523_ai_generation_records from './20261024_124523_ai_generation_records';
import * as migration_20261024_134849_audit_logs from './20261024_134849_audit_logs';
import * as migration_20261025_041929_issue005_resources from './20261025_041929_issue005_resources';
import * as migration_20261025_064749_issue006_source_materials from './20261025_064749_issue006_source_materials';
import * as migration_20261026_054250_issue014_source_workflow from './20261026_054250_issue014_source_workflow';
import * as migration_20261026_055301_issue014_resource_owner from './20261026_055301_issue014_resource_owner';
import * as migration_20261026_072026_issue010_ai_image_workbench from './20261026_072026_issue010_ai_image_workbench';
import * as migration_20261027_111500_issue017_image_provider from './20261027_111500_issue017_image_provider';

export const migrations = [
  {
    up: migration_20261024_113020_sprint1_content.up,
    down: migration_20261024_113020_sprint1_content.down,
    name: '20261024_113020_sprint1_content',
  },
  {
    up: migration_20261024_124523_ai_generation_records.up,
    down: migration_20261024_124523_ai_generation_records.down,
    name: '20261024_124523_ai_generation_records',
  },
  {
    up: migration_20261024_134849_audit_logs.up,
    down: migration_20261024_134849_audit_logs.down,
    name: '20261024_134849_audit_logs',
  },
  {
    up: migration_20261025_041929_issue005_resources.up,
    down: migration_20261025_041929_issue005_resources.down,
    name: '20261025_041929_issue005_resources',
  },
  {
    up: migration_20261025_064749_issue006_source_materials.up,
    down: migration_20261025_064749_issue006_source_materials.down,
    name: '20261025_064749_issue006_source_materials',
  },
  {
    up: migration_20261026_054250_issue014_source_workflow.up,
    down: migration_20261026_054250_issue014_source_workflow.down,
    name: '20261026_054250_issue014_source_workflow',
  },
  {
    up: migration_20261026_055301_issue014_resource_owner.up,
    down: migration_20261026_055301_issue014_resource_owner.down,
    name: '20261026_055301_issue014_resource_owner',
  },
  {
    up: migration_20261026_072026_issue010_ai_image_workbench.up,
    down: migration_20261026_072026_issue010_ai_image_workbench.down,
    name: '20261026_072026_issue010_ai_image_workbench'
  },
  {
    up: migration_20261027_111500_issue017_image_provider.up,
    down: migration_20261027_111500_issue017_image_provider.down,
    name: '20261027_111500_issue017_image_provider',
  },
];
