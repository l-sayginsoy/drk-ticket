// Regeltests für firestore.sicher.rules (nur Emulator, nur synthetische Daten).
// Aufruf:  npm run test:rules   (startet den Emulator selbst, Java nötig: JAVA_HOME setzen)
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const temp = await mkdtemp(join(tmpdir(), 'drk-rules-tests-'));
try {
  const outfile = join(temp, 'rules.cjs');
  await build({ entryPoints: ['tests/rules.test.mjs'], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error' });
  const r = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' });
  process.exitCode = r.status ?? 1;
} finally { await rm(temp, { recursive: true, force: true }); }
