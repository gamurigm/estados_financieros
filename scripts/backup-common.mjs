import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { StringDecoder } from 'node:string_decoder';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse } from 'dotenv';

export const backupHeader = Buffer.from('EFDB1');
export const productionRestoreConfirmation = 'REEMPLAZAR PRODUCCION';
export const productionMigrationConfirmation = 'MIGRAR PRODUCCION';
const saltLength = 16;
const ivLength = 12;
const tagLength = 16;
const metadataLength = backupHeader.length + saltLength + ivLength + tagLength;

export function encryptDump(dump, password) {
  const salt = randomBytes(saltLength);
  const iv = randomBytes(ivLength);
  const key = scryptSync(password, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  return Buffer.concat([backupHeader, salt, iv, cipher.getAuthTag(), encrypted]);
}

export function decryptDump(snapshot, password) {
  if (!hasValidBackupHeader(snapshot)) throw new Error('Formato de respaldo desconocido.');
  const saltStart = backupHeader.length;
  const ivStart = saltStart + saltLength;
  const tagStart = ivStart + ivLength;
  const encryptedStart = tagStart + tagLength;
  const salt = snapshot.subarray(saltStart, ivStart);
  const iv = snapshot.subarray(ivStart, tagStart);
  const tag = snapshot.subarray(tagStart, encryptedStart);
  const encrypted = snapshot.subarray(encryptedStart);
  const key = scryptSync(password, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new Error('La contraseña no coincide o el respaldo está dañado.');
  }
}

export function hasValidBackupHeader(snapshot) {
  return Buffer.isBuffer(snapshot) && snapshot.length >= metadataLength && snapshot.subarray(0, backupHeader.length).equals(backupHeader);
}

export async function encryptDumpStream(source, outputPath, password) {
  const temporaryDirectory = await mkdirTemp('finance-encrypt-');
  const encryptedBodyPath = join(temporaryDirectory, 'encrypted-body');
  const outputTempPath = `${outputPath}.${randomUUID()}.tmp`;
  const salt = randomBytes(saltLength);
  const iv = randomBytes(ivLength);
  const key = scryptSync(password, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await pipeline(source, cipher, createWriteStream(encryptedBodyPath, { flags: 'wx', mode: 0o600 }));
    const metadata = Buffer.concat([backupHeader, salt, iv, cipher.getAuthTag()]);
    const snapshot = Readable.from((async function* () {
      yield metadata;
      for await (const chunk of createReadStream(encryptedBodyPath)) yield chunk;
    })());
    await pipeline(snapshot, createWriteStream(outputTempPath, { flags: 'wx', mode: 0o600 }));
    await rename(outputTempPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await rm(outputTempPath, { force: true });
  }
}

export async function decryptBackupToTemp(backupPath, password) {
  const file = await open(backupPath, 'r');
  const metadata = Buffer.alloc(metadataLength);
  try {
    const { bytesRead } = await file.read(metadata, 0, metadata.length, 0);
    if (bytesRead !== metadataLength || !hasValidBackupHeader(metadata)) throw new Error('Formato de respaldo desconocido.');
  } finally {
    await file.close();
  }

  const saltStart = backupHeader.length;
  const ivStart = saltStart + saltLength;
  const tagStart = ivStart + ivLength;
  const encryptedStart = tagStart + tagLength;
  const salt = metadata.subarray(saltStart, ivStart);
  const iv = metadata.subarray(ivStart, tagStart);
  const tag = metadata.subarray(tagStart, encryptedStart);
  const key = scryptSync(password, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const directory = await mkdirTemp('finance-decrypt-');
  const dumpPath = join(directory, 'database.dump');

  try {
    await pipeline(createReadStream(backupPath, { start: encryptedStart }), decipher, createWriteStream(dumpPath, { flags: 'wx', mode: 0o600 }));
    return { dumpPath, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch {
    await rm(directory, { recursive: true, force: true });
    throw new Error('La contraseña no coincide o el respaldo está dañado.');
  }
}

export async function assertBackupFileFormat(backupPath) {
  const file = await open(backupPath, 'r');
  const metadata = Buffer.alloc(metadataLength);
  try {
    const { bytesRead } = await file.read(metadata, 0, metadata.length, 0);
    if (bytesRead !== metadataLength || !hasValidBackupHeader(metadata)) throw new Error('Formato de respaldo desconocido.');
  } finally {
    await file.close();
  }
}

export async function readEnvFile(path) {
  return parse(await readFile(path, 'utf8'));
}

export async function loadCloudConfig() {
  let fileEnv = {};
  try {
    fileEnv = await readEnvFile('.env.production');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const values = { ...fileEnv, ...process.env };
  return validateCloudConfig({
    sshTarget: values.CLOUD_SSH_TARGET,
    remoteDir: values.CLOUD_REMOTE_DIR || '/opt/estados_financieros',
  });
}

export function validateCloudConfig(config) {
  if (typeof config?.sshTarget !== 'string' || !config.sshTarget || config.sshTarget.startsWith('-') || !/^[a-zA-Z0-9_.@:-]+$/.test(config.sshTarget)) {
    throw new Error('Define CLOUD_SSH_TARGET como alias de ~/.ssh/config o usuario@host en .env.production.');
  }
  const remoteDir = config.remoteDir || '/opt/estados_financieros';
  if (!remoteDir.startsWith('/') || remoteDir.includes('..') || !/^\/[a-zA-Z0-9_./-]+$/.test(remoteDir)) {
    throw new Error('CLOUD_REMOTE_DIR debe ser una ruta absoluta válida en Linux.');
  }
  return { sshTarget: config.sshTarget, remoteDir };
}

export function remoteComposeCommand(config, action) {
  const { remoteDir } = validateCloudConfig(config);
  const compose = `docker compose --env-file '${remoteDir}/.env.production' -f '${remoteDir}/compose.prod.yml' exec -T db`;
  if (action === 'dump') return `cd '${remoteDir}' && ${compose} sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`;
  if (action === 'restore') return `cd '${remoteDir}' && ${compose} sh -c 'exec pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`;
  if (action === 'query') return `cd '${remoteDir}' && ${compose} sh -c 'exec psql -X -A -t -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`;
  throw new Error('Acción remota no válida.');
}

export function ensureGithubBackupTarget() {
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
  if (staged) throw new Error('Confirma o descarta primero los cambios ya preparados en Git.');
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) throw new Error('Configura origin con un repositorio GitHub privado antes de publicar el respaldo.');
  const privacy = execFileSync('gh', ['repo', 'view', `${match[1]}/${match[2]}`, '--json', 'isPrivate', '--jq', '.isPrivate'], { encoding: 'utf8' }).trim();
  if (privacy !== 'true') throw new Error('El respaldo contiene información financiera. Usa un repositorio privado.');
}

export function uploadEncryptedBackup(path = 'backup/database.dump.enc') {
  ensureGithubBackupTarget();
  execFileSync('git', ['add', '--', path], { stdio: 'inherit' });
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
  if (!staged) return false;
  if (staged.split(/\r?\n/).some((file) => file !== path)) {
    execFileSync('git', ['reset', '--', path], { stdio: 'ignore' });
    throw new Error('El respaldo no es el único archivo preparado para Git.');
  }
  execFileSync('git', ['commit', '-m', 'backup: encrypted PostgreSQL snapshot'], { stdio: 'inherit' });
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  if (!branch) throw new Error('Cambia a una rama con nombre antes de subir el respaldo.');
  execFileSync('git', ['push', 'origin', `HEAD:refs/heads/${branch}`], { stdio: 'inherit' });
  return true;
}

export async function promptSecret(message) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') throw new Error('Ejecuta este comando en una terminal interactiva.');
  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const decoder = new StringDecoder('utf8');

  return new Promise((resolvePrompt, rejectPrompt) => {
    let value = '';
    const onData = (chunk) => {
      for (const char of decoder.write(Buffer.from(chunk))) {
        if (char === '\u0003') {
          cleanup();
          rejectPrompt(new Error('Operación cancelada.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          resolvePrompt(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = Array.from(value).slice(0, -1).join('');
          continue;
        }
        if (char >= ' ' && char !== '\u001b') value += char;
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    process.stdin.on('data', onData);
  });
}

export async function promptConfirmation(message) {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
  process.stdout.write(message);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await prompt.question('');
  } finally {
    prompt.close();
  }
}

export function spawnProcess(command, args, options = {}) {
  return spawn(command, args, { ...options, windowsHide: true });
}

export async function* checkedStdout(child, label) {
  const closed = waitForClose(child);
  try {
    for await (const chunk of child.stdout) yield chunk;
    const { code, signal } = await closed;
    if (code !== 0 || signal) throw new Error(`${label} terminó sin éxito.`);
  } catch (error) {
    if (child.exitCode === null && !child.killed) child.kill();
    throw error;
  }
}

export async function runSshRestore(config, dumpPath) {
  const target = validateCloudConfig(config);
  const child = spawnProcess('ssh', ['-T', target.sshTarget, remoteComposeCommand(target, 'restore')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = waitForClose(child);
  try {
    const [, { code, signal }] = await Promise.all([pipeline(createReadStream(dumpPath), child.stdin), closed]);
    if (code !== 0 || signal) throw new Error('pg_restore remoto terminó sin éxito.');
  } catch (error) {
    if (child.exitCode === null && !child.killed) child.kill();
    throw error;
  }
}

export async function runSshQuery(config, sql) {
  const target = validateCloudConfig(config);
  const child = spawnProcess('ssh', ['-T', target.sshTarget, remoteComposeCommand(target, 'query')], { stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = waitForClose(child);
  const output = collectOutput(child.stdout);
  try {
    const [, result, { code, signal }] = await Promise.all([
      pipeline(Readable.from([sql]), child.stdin),
      output,
      closed,
    ]);
    if (code !== 0 || signal) throw new Error('Consulta PostgreSQL remota terminó sin éxito.');
    return result;
  } catch (error) {
    if (child.exitCode === null && !child.killed) child.kill();
    throw error;
  }
}

export function runLocalQuery(args, sql) {
  try {
    return execFileSync('docker', args, { input: sql, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    throw new Error('Consulta PostgreSQL local terminó sin éxito.', { cause: error });
  }
}

async function mkdirTemp(prefix) {
  const path = join(tmpdir(), `${prefix}${randomUUID()}`);
  await mkdir(path, { recursive: false });
  return path;
}

async function collectOutput(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function waitForClose(child) {
  const closed = new Promise((resolveClose, rejectClose) => {
    const onError = (error) => rejectClose(error);
    child.once('error', onError);
    child.once('close', (code, signal) => {
      child.off('error', onError);
      resolveClose({ code, signal });
    });
  });
  closed.catch(() => {});
  return closed;
}
