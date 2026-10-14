import { config as loadEnv } from 'dotenv';

const localEnv: NodeJS.ProcessEnv = {};
loadEnv({ processEnv: localEnv });

if (!localEnv.DB_PATH) throw new Error('DB_PATH must be set in .env for local development');

process.env.DB_PATH = localEnv.DB_PATH;
delete process.env.DATABASE_URL;

await import('../src/main.js');
