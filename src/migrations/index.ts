import * as migration_20261024_113020_sprint1_content from './20261024_113020_sprint1_content';
import * as migration_20261024_124523_ai_generation_records from './20261024_124523_ai_generation_records';

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
];
