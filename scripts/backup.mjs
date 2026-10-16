import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
const password = await promptSecret('Contraseña para cifrar el respaldo: ');
if (password.length < 12) throw new Error('Usa una contraseña de al menos 12 caracteres.');

const dump = execFileSync('docker', ['compose', 'exec', '-T', 'db', 'pg_dump', '-Fc', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB], { maxBuffer: 256 * 1024 * 1024 });
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = scryptSync(password, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
const snapshot = Buffer.concat([Buffer.from('EFDB1'), salt, iv, cipher.getAuthTag(), encrypted]);
const backupPath = resolve('backup', 'database.dump.enc');
await mkdir(resolve('backup'), { recursive: true });
await writeFile(backupPath, snapshot);
console.log('Respaldo PostgreSQL cifrado guardado en backup/database.dump.enc.');

try {
  execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: 'ignore' });
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
  if (staged) throw new Error('Confirma o descarta primero los cambios ya preparados en Git.');
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) throw new Error('Configura origin con un repositorio GitHub privado antes de publicar el respaldo.');
  const privacy = execFileSync('gh', ['repo', 'view', `${match[1]}/${match[2]}`, '--json', 'isPrivate', '--jq', '.isPrivate'], { encoding: 'utf8' }).trim();
  if (privacy !== 'true') throw new Error('El respaldo contiene información financiera. Usa un repositorio privado.');
  execFileSync('git', ['add', '--', 'backup/database.dump.enc'], { stdio: 'inherit' });
  const stagedFiles = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
  if (!stagedFiles) {
    console.log('No hubo cambios en el respaldo.');
    process.exit(0);
  }
} catch (error) {
  if (error.status !== 1) throw error;
}

execFileSync('git', ['commit', '-m', 'backup: encrypted local PostgreSQL'], { stdio: 'inherit' });
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
if (!branch) throw new Error('Cambia a una rama con nombre antes de subir el respaldo.');
execFileSync('git', ['push', 'origin', `HEAD:refs/heads/${branch}`], { stdio: 'inherit' });
console.log('Respaldo cifrado enviado a GitHub.');

async function promptSecret(message) {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  return new Promise((resolvePromise) => {
    const onData = (buffer) => {
      const char = buffer.toString('utf8');
      if (char === '\u0003') { process.stdin.setRawMode(false); process.exit(130); }
      if (char === '\r' || char === '\n') {
        process.stdin.off('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolvePromise(value);
      } else if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
      } else if (char >= ' ') {
        value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}
