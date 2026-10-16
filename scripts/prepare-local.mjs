import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';

try {
  await access('.env');
} catch {
  const password = randomBytes(24).toString('base64url');
  await writeFile('.env', [
    'POSTGRES_DB=estados_financieros',
    'POSTGRES_USER=estados_app',
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgres://estados_app:${password}@127.0.0.1:5432/estados_financieros`,
    'PORT=3001',
    '',
  ].join('\n'), { flag: 'wx' });
  console.log('Archivo local .env creado con una contraseña aleatoria.');
}
