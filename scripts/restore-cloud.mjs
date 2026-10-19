import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { assertBackupFileFormat, decryptBackupToTemp, loadCloudConfig, productionRestoreConfirmation, promptConfirmation, promptSecret, runSshRestore, validateCloudConfig } from './backup-common.mjs';

export async function runCloudRestore(options = {}) {
  const getConfig = options.getConfig ?? loadCloudConfig;
  const config = validateCloudConfig(await getConfig());
  const backupPath = options.backupPath ?? resolve('backup', 'database.dump.enc');
  await (options.validateBackup ?? assertBackupFileFormat)(backupPath);
  const getPassword = options.getPassword ?? (() => promptSecret('Contraseña del respaldo: '));
  const password = await getPassword();
  const getConfirmation = options.getConfirmation ?? (() => promptConfirmation(`Esto reemplazará los datos de producción. Escribe ${productionRestoreConfirmation}: `));
  const confirmation = await getConfirmation();
  if (confirmation !== productionRestoreConfirmation) throw new Error('Restauración cancelada.');
  const decrypt = options.decryptBackup ?? decryptBackupToTemp;
  const decrypted = await decrypt(backupPath, password);
  try {
    const restoreRemote = options.restoreRemote ?? runSshRestore;
    await restoreRemote(config, decrypted.dumpPath);
  } finally {
    await decrypted.cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCloudRestore();
  console.log('Respaldo restaurado en producción.');
}
