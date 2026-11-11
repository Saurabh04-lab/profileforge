
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", error => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
});

// ==========================================
// INITIALIZE DATABASE AND MIGRATIONS
// ==========================================

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Users and account credentials
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(60) NOT NULL,
                email VARCHAR(254) NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
            ON users (LOWER(email));
        `);

        // Create profiles table for new installations.
        await client.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                id BIGSERIAL PRIMARY KEY,
                full_name VARCHAR(60) NOT NULL,
                headline VARCHAR(80) NOT NULL DEFAULT '',
                bio VARCHAR(240) NOT NULL DEFAULT '',
                skills JSONB NOT NULL DEFAULT '[]'::jsonb,
                socials JSONB NOT NULL DEFAULT '{}'::jsonb,
                theme VARCHAR(20) NOT NULL DEFAULT 'midnight'
                    CHECK (theme IN ('midnight', 'ocean', 'sunset')),
                avatar_data_url TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // Add owner_id to existing installations.
        await client.query(`
            ALTER TABLE profiles
            ADD COLUMN IF NOT EXISTS owner_id BIGINT;
        `);

        // Add ownership relationship.
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'profiles_owner_id_fkey'
                ) THEN
                    ALTER TABLE profiles
                    ADD CONSTRAINT profiles_owner_id_fkey
                    FOREIGN KEY (owner_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE;
                END IF;
            END
            $$;
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS profiles_owner_created_idx
            ON profiles (owner_id, created_at DESC);
        `);

        await client.query("COMMIT");

        console.log("Database tables and migrations initialized.");

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
}

// ==========================================
// DATABASE CONNECTION CHECK
// ==========================================

async function checkDatabaseConnection() {
    const result = await pool.query(`
        SELECT NOW() AS database_time,
               VERSION() AS database_version
    `);

    return result.rows[0];
}

module.exports = {
    pool,
    initializeDatabase,
    checkDatabaseConnection
};
