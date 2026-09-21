// Start a Firestore emulator for demo-drk-ticket-regression on 127.0.0.1:8787 first.
// Only synthetic data is used. No production configuration or credentials are loaded.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const temp = await mkdtemp(join(tmpdir(),'drk-ticket-tests-'));
try {
 const outfile=join(temp,'tests.cjs');
 await build({entryPoints:['tests/ticketPersistence.test.mjs'],bundle:true,platform:'node',format:'cjs',outfile});
 const result=spawnSync(process.execPath,['--test',outfile],{stdio:'inherit'});
 process.exitCode=result.status ?? 1;
} finally {await rm(temp,{recursive:true,force:true})}
