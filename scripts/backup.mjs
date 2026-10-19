import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encryptDump, promptSecret, readEnvFile, uploadEncryptedBackup } from './backup-common.mjs';

const env = await readEnvFile('.env');
const password = await promptSecret('Contraseña para cifrar el respaldo: ');
if (password.length < 12) throw new Error('Usa una contraseña de al menos 12 caracteres.');

const dump = execFileSync('docker', ['compose', 'exec', '-T', 'db', 'pg_dump', '-Fc', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB], { maxBuffer: 256 * 1024 * 1024 });
const snapshot = encryptDump(dump, password);
const backupPath = resolve('backup', 'database.dump.enc');
await mkdir(resolve('backup'), { recursive: true });
await writeFile(backupPath, snapshot);
console.log('Respaldo PostgreSQL cifrado guardado en backup/database.dump.enc.');

if (!uploadEncryptedBackup()) {
  console.log('No hubo cambios en el respaldo.');
  process.exit(0);
}
console.log('Respaldo cifrado enviado a GitHub.');
