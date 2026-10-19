import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { checkedStdout, encryptDumpStream, ensureGithubBackupTarget, loadCloudConfig, promptSecret, remoteComposeCommand, spawnProcess, uploadEncryptedBackup, validateCloudConfig } from './backup-common.mjs';
import { Readable } from 'node:stream';

export async function runCloudBackup(options = {}) {
  const config = validateCloudConfig(await (options.getConfig ?? loadCloudConfig)());
  (options.ensureUpload ?? ensureGithubBackupTarget)();
  const password = await (options.getPassword ?? (() => promptSecret('Contraseña para cifrar el respaldo: ')))();
  if (password.length < 12) throw new Error('Usa una contraseña de al menos 12 caracteres.');

  const backupPath = options.backupPath ?? resolve('backup', 'database.dump.enc');
  const dump = await (options.getRemoteDump ?? remoteDump)(config);
  await (options.encrypt ?? encryptDumpStream)(dump, backupPath, password);
  console.log('Respaldo PostgreSQL cifrado guardado en backup/database.dump.enc.');
  const uploaded = await (options.upload ?? (() => uploadEncryptedBackup()))();
  if (!uploaded) {
    console.log('No hubo cambios en el respaldo.');
    return;
  }
  console.log('Respaldo cifrado enviado a GitHub.');
}

function remoteDump(config) {
  const child = spawnProcess('ssh', ['-T', config.sshTarget, remoteComposeCommand(config, 'dump')], { stdio: ['ignore', 'pipe', 'inherit'] });
  return Readable.from(checkedStdout(child, 'pg_dump remoto'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCloudBackup();
}
