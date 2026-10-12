const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', 'tests/logic/known-gaps.test.cjs'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit'
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
