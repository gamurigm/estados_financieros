import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { decryptDump, encryptDump, remoteComposeCommand } from './backup-common.mjs';
import { runCloudBackup } from './backup-cloud.mjs';
import { localMigrationDumpArgs, runCloudMigration } from './migrate-cloud.mjs';
import { runCloudRestore } from './restore-cloud.mjs';
import { compareFinanceSnapshots } from './verify-cloud.mjs';

const password = 'cloud-backup-test-passphrase';
const dump = Buffer.from('test PostgreSQL dump');
const snapshot = encryptDump(dump, password);

test('cloud backup keeps existing encrypted format and decrypts its dump', () => {
  assert.equal(snapshot.subarray(0, 5).toString(), 'EFDB1');
  assert.deepEqual(decryptDump(snapshot, password), dump);
});

test('wrong passphrase never runs remote restore', async () => {
  const calls = [];
  await assert.rejects(runRestore({
    password: 'wrong-passphrase',
    restoreRemote: async (...args) => calls.push(args),
  }));
  assert.equal(calls.length, 0);
});

test('damaged backup header never runs remote restore', async () => {
  const damaged = Buffer.from(snapshot);
  damaged[0] = 0;
  const calls = [];
  await assert.rejects(runRestore({
    backup: damaged,
    restoreRemote: async (...args) => calls.push(args),
  }), /Formato de respaldo desconocido/);
  assert.equal(calls.length, 0);
});

test('missing SSH target never runs remote restore', async () => {
  const calls = [];
  await assert.rejects(runRestore({
    config: { remoteDir: '/srv/finance' },
    restoreRemote: async (...args) => calls.push(args),
  }), /CLOUD_SSH_TARGET/);
  assert.equal(calls.length, 0);
});

test('missing production confirmation never runs remote restore', async () => {
  const calls = [];
  await assert.rejects(runRestore({
    confirmation: 'REEMPLAZAR',
    restoreRemote: async (...args) => calls.push(args),
  }), /Restauración cancelada/);
  assert.equal(calls.length, 0);
});

test('confirmed cloud restore streams the decrypted dump to the remote handler', async () => {
  let restoredDump;
  await runRestore({ restoreRemote: async (_config, path) => { restoredDump = await readFile(path); } });
  assert.deepEqual(restoredDump, dump);
});

test('cloud backup encrypts streamed dump in the existing format', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'finance-cloud-backup-test-'));
  const backupPath = join(directory, 'database.dump.enc');
  try {
    await runCloudBackup({
      getConfig: () => ({ sshTarget: 'finance-test', remoteDir: '/srv/finance' }),
      ensureUpload: () => {},
      getPassword: async () => password,
      getRemoteDump: async () => Readable.from([dump]),
      backupPath,
      upload: async () => false,
    });
    const saved = await readFile(backupPath);
    assert.equal(saved.subarray(0, 5).toString(), 'EFDB1');
    assert.deepEqual(decryptDump(saved, password), dump);
    await runCloudBackup({
      getConfig: () => ({ sshTarget: 'finance-test', remoteDir: '/srv/finance' }),
      ensureUpload: () => {},
      getPassword: async () => password,
      getRemoteDump: async () => Readable.from([Buffer.concat([dump, Buffer.from(' updated')])]),
      backupPath,
      upload: async () => false,
    });
    assert.deepEqual(decryptDump(await readFile(backupPath), password), Buffer.concat([dump, Buffer.from(' updated')]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('cancelled cloud migration never runs remote restore', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'finance-cloud-migrate-test-'));
  const backupPath = join(directory, 'database.dump.enc');
  const calls = [];
  try {
    await assert.rejects(runCloudMigration({
      getConfig: () => ({ sshTarget: 'finance-test', remoteDir: '/srv/finance' }),
      ensureUpload: () => {},
      getPassword: async () => password,
      getLocalDump: async () => Readable.from([dump]),
      backupPath,
      upload: async () => true,
      getConfirmation: async () => 'MIGRAR',
      restoreRemote: async (...args) => calls.push(args),
    }), /Migración cancelada/);
    assert.equal(calls.length, 0);
    assert.equal((await readFile(backupPath)).subarray(0, 5).toString(), 'EFDB1');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('confirmed cloud migration restores the encrypted local snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'finance-cloud-migrate-confirmed-'));
  const backupPath = join(directory, 'database.dump.enc');
  let restoredDump;
  try {
    await runCloudMigration({
      getConfig: () => ({ sshTarget: 'finance-test', remoteDir: '/srv/finance' }),
      ensureUpload: () => {},
      getPassword: async () => password,
      getLocalDump: async () => Readable.from([dump]),
      backupPath,
      upload: async () => true,
      getConfirmation: async () => 'MIGRAR PRODUCCION',
      restoreRemote: async (_config, path) => { restoredDump = await readFile(path); },
    });
    assert.deepEqual(restoredDump, dump);
    assert.equal((await readFile(backupPath)).subarray(0, 5).toString(), 'EFDB1');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local migration dump leaves production owner credentials and sessions intact', () => {
  const args = localMigrationDumpArgs({ POSTGRES_USER: 'finance', POSTGRES_DB: 'finance' });
  assert.ok(args.includes('--exclude-table=public.owner_credentials'));
  assert.ok(args.includes('--exclude-table=public.auth_sessions'));
});

test('remote PostgreSQL commands expand credentials only inside the container', () => {
  const command = remoteComposeCommand({ sshTarget: 'finance-test', remoteDir: '/srv/finance' }, 'restore');
  assert.match(command, /exec -T db sh -c 'exec pg_restore/);
  assert.match(command, /"\$POSTGRES_USER" -d "\$POSTGRES_DB"/);
  assert.throws(() => remoteComposeCommand({ sshTarget: 'finance-test', remoteDir: "/srv/finance'; touch /tmp/bad" }, 'restore'), /CLOUD_REMOTE_DIR/);
});

test('cloud verification compares categories, opening balances, counts, and calculated balances', () => {
  const source = {
    categories: [{ id: 'a', name: 'Comida', kind: 'expense', active: true }],
    accounts: [{ key: 'cash', openingBalance: '10.00' }, { key: 'bank', openingBalance: '0.00' }],
    movementCount: '2',
    latestDate: '2026-10-19',
    balanceThroughLatest: { cash: '5.00', bank: '7.25' },
  };
  const matching = {
    ...source,
    accounts: [{ key: 'bank', openingBalance: 0 }, { key: 'cash', openingBalance: 10 }],
    movementCount: 2,
    balanceThroughLatest: { bank: 7.25, cash: 5 },
  };
  assert.deepEqual(compareFinanceSnapshots(source, matching), { matches: true, differences: [], latestDate: '2026-10-19' });

  const mismatch = {
    ...matching,
    categories: [{ id: 'a', name: 'Comida y snacks', kind: 'expense', active: true }],
    accounts: [{ key: 'bank', openingBalance: 0 }, { key: 'cash', openingBalance: 11 }],
    movementCount: 3,
    latestDate: '2026-10-20',
    balanceThroughLatest: { cash: 4, bank: 7.25 },
  };
  assert.deepEqual(compareFinanceSnapshots(source, mismatch).differences, ['rubros', 'saldos iniciales', 'cantidad de movimientos', 'última fecha', 'saldos calculados']);
});

async function runRestore(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'finance-cloud-test-'));
  const backupPath = join(directory, 'database.dump.enc');
  await writeFile(backupPath, overrides.backup ?? snapshot);
  try {
    return await runCloudRestore({
      backupPath,
      getConfig: () => overrides.config ?? ({ sshTarget: 'finance-test', remoteDir: '/srv/finance' }),
      getPassword: async () => overrides.password ?? password,
      getConfirmation: async () => overrides.confirmation ?? 'REEMPLAZAR PRODUCCION',
      restoreRemote: async () => {},
      ...overrides,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
