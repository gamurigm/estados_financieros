import 'dotenv/config';
import { StringDecoder } from 'node:string_decoder';
import { Pool } from 'pg';
import { createOwner } from '../server/auth-crypto.ts';

if (process.argv.length !== 2) throw new Error('No pases credenciales como argumentos.');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está configurado.');

const pool = new Pool({ connectionString });

try {
  const username = await promptText('Usuario: ', false);
  const password = await promptText('Contraseña: ', true);
  await createOwner(pool, username, password);
  console.log('Propietario creado.');
} finally {
  await pool.end();
}

function promptText(prompt, hidden) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Ejecuta este comando en una terminal interactiva.');
  }

  process.stdout.write(prompt);
  input.setRawMode(true);
  input.resume();
  const decoder = new StringDecoder('utf8');

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of decoder.write(Buffer.from(chunk))) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Creación cancelada.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = Array.from(value).slice(0, -1).join('');
          if (!hidden) process.stdout.write('\b \b');
          continue;
        }
        if (char >= ' ' && char !== '\u001b') {
          value += char;
          if (!hidden) process.stdout.write(char);
        }
      }
    };
    input.on('data', onData);
  });
}
