import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { checkedStdout, decryptBackupToTemp, encryptDumpStream, ensureGithubBackupTarget, loadCloudConfig, productionMigrationConfirmation, promptConfirmation, promptSecret, readEnvFile, runSshRestore, spawnProcess, uploadEncryptedBackup, validateCloudConfig } from './backup-common.mjs';

export async function runCloudMigration(options = {}) {
  const config = validateCloudConfig(await (options.getConfig ?? loadCloudConfig)());
  (options.ensureUpload ?? ensureGithubBackupTarget)();
  const password = await (options.getPassword ?? (() => promptSecret('Contraseña para cifrar el respaldo: ')))();
  if (password.length < 12) throw new Error('Usa una contraseña de al menos 12 caracteres.');

  const backupPath = options.backupPath ?? resolve('backup', 'database.dump.enc');
  const dump = await (options.getLocalDump ?? localDump)();
  await (options.encrypt ?? encryptDumpStream)(dump, backupPath, password);
  const uploaded = await (options.upload ?? (() => uploadEncryptedBackup()))();
  if (!uploaded) console.log('Respaldo cifrado guardado; no hubo cambios para publicar.');
  else console.log('Respaldo cifrado publicado en GitHub.');

  const confirmation = await (options.getConfirmation ?? (() => promptConfirmation(`Esto reemplazará la base de producción. Escribe ${productionMigrationConfirmation}: `)))();
  if (confirmation !== productionMigrationConfirmation) throw new Error('Migración cancelada; el respaldo cifrado permanece guardado.');

  const decrypt = options.decryptBackup ?? decryptBackupToTemp;
  const decrypted = await decrypt(backupPath, password);
  try {
    await (options.restoreRemote ?? runSshRestore)(config, decrypted.dumpPath);
  } finally {
    await decrypted.cleanup();
  }
  console.log('Base local migrada a producción. Ejecuta npm run verify:cloud antes del cambio de clientes.');
}

async function localDump() {
  const env = await readEnvFile('.env');
  if (!env.POSTGRES_USER || !env.POSTGRES_DB) throw new Error('Configura PostgreSQL local con npm run db:up.');
  const child = spawnProcess('docker', localMigrationDumpArgs(env), { stdio: ['ignore', 'pipe', 'inherit'] });
  return Readable.from(checkedStdout(child, 'pg_dump local'));
}

export function localMigrationDumpArgs(env) {
  return ['compose', 'exec', '-T', 'db', 'pg_dump', '-Fc', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB, '--exclude-table=public.owner_credentials', '--exclude-table=public.auth_sessions'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCloudMigration();
}
