import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const testScript = pkg.scripts?.test ?? '';
const files = readdirSync(resolve(root, 'scripts/regression'))
  .filter(name => name.endsWith('.test.ts'))
  .sort();
const missing = files.filter(name => !testScript.includes(`scripts/regression/${name}`));

if (files.length === 0 || missing.length > 0) {
  console.error('Regression registration check failed. Missing:', missing.join(', ') || '(no test files found)');
  process.exitCode = 1;
} else {
  console.log(`Regression registration check passed: ${files.length} test files registered.`);
}
