import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { decryptDump, hasValidBackupHeader, promptConfirmation, promptSecret, readEnvFile } from './backup-common.mjs';

const backup = await readFile('backup/database.dump.enc');
if (!hasValidBackupHeader(backup)) throw new Error('Formato de respaldo desconocido.');
const password = await promptSecret('Contraseña del respaldo: ');
const dump = decryptDump(backup, password);

const confirmation = await promptConfirmation('Esto reemplazará los datos actuales de PostgreSQL con el respaldo. Escribe REEMPLAZAR para continuar: ');
if (confirmation !== 'REEMPLAZAR') throw new Error('Restauración cancelada.');
execFileSync('node', ['scripts/prepare-local.mjs'], { stdio: 'inherit' });
execFileSync('docker', ['compose', 'up', '-d', '--wait', 'db'], { stdio: 'inherit' });
const env = await readEnvFile('.env');
execFileSync('docker', ['compose', 'exec', '-T', 'db', 'pg_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB], { input: dump, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('Base restaurada desde GitHub.');
