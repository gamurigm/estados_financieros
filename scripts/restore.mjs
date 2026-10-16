import { createDecipheriv, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const backup = await readFile('backup/database.dump.enc');
if (backup.subarray(0, 5).toString() !== 'EFDB1') throw new Error('Formato de respaldo desconocido.');
const password = await promptSecret('Contraseña del respaldo: ');
const salt = backup.subarray(5, 21);
const iv = backup.subarray(21, 33);
const tag = backup.subarray(33, 49);
const encrypted = backup.subarray(49);
const key = scryptSync(password, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
const dump = Buffer.concat([decipher.update(encrypted), decipher.final()]);

process.stdout.write('Esto reemplazará los datos actuales de PostgreSQL con el respaldo. Escribe REEMPLAZAR para continuar: ');
const confirmation = await promptLine();
if (confirmation !== 'REEMPLAZAR') throw new Error('Restauración cancelada.');
execFileSync('node', ['scripts/prepare-local.mjs'], { stdio: 'inherit' });
execFileSync('docker', ['compose', 'up', '-d', '--wait', 'db'], { stdio: 'inherit' });
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
execFileSync('docker', ['compose', 'exec', '-T', 'db', 'pg_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB], { input: dump, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('Base restaurada desde GitHub.');

async function promptSecret(message) {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolvePromise) => {
    let value = '';
    const onData = (buffer) => {
      const char = buffer.toString('utf8');
      if (char === '\u0003') { process.stdin.setRawMode(false); process.exit(130); }
      if (char === '\r' || char === '\n') {
        process.stdin.off('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolvePromise(value);
      } else if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
      else if (char >= ' ') value += char;
    };
    process.stdin.on('data', onData);
  });
}

async function promptLine() {
  process.stdin.resume();
  return new Promise((resolvePromise) => {
    let value = '';
    const onData = (buffer) => {
      const char = buffer.toString('utf8');
      if (char === '\r' || char === '\n') {
        process.stdin.off('data', onData);
        process.stdin.pause();
        process.stdout.write('\n');
        resolvePromise(value);
      } else if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
      else if (char >= ' ') value += char;
    };
    process.stdin.on('data', onData);
  });
}
