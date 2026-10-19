import 'dotenv/config';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { PgAuthStore } from './auth-store.js';

const port = Number(process.env.PORT ?? 3001);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = createApp(pool, new PgAuthStore(pool));
app.listen(port, '127.0.0.1', () => console.log(`API local en http://127.0.0.1:${port}`));
