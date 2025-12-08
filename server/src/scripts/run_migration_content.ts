// @ts-ignore
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    // Construct connection string if not explicit
    // Supabase URL is usually: postgres://postgres.[ref]:[password]@[host]:6543/postgres
    // We might have DATABASE_URL in env.

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Missing DATABASE_URL in .env');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../../../../design/add_content_to_sessions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running SQL migration...');
        await client.query(sql);
        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
