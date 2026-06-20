import postgres from 'postgres';

const dbUrl = process.env['DATABASE_URL'];
if (!dbUrl) throw new Error('DATABASE_URL not set');

const sql = postgres(dbUrl);
try {
  await sql`
    CREATE TABLE IF NOT EXISTS "metrics_kv" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  console.log('done');
} finally {
  await sql.end();
}
