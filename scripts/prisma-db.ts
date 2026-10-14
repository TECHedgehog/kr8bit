import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { config as loadEnv } from 'dotenv';

const localEnv: NodeJS.ProcessEnv = {};
loadEnv({ processEnv: localEnv });

if (!localEnv.DB_PATH) throw new Error('DB_PATH must be set in .env for local Prisma commands');

process.env.DB_PATH = localEnv.DB_PATH;
delete process.env.DATABASE_URL;

const { config } = await import('../src/config/index.js');
process.env.DATABASE_URL = config.databaseUrl;

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma');
const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Failed to start Prisma CLI: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
