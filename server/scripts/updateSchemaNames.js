// Adds user_name to tickets and to_name to email_queue if they don't exist
// Usage: from server folder -> npm run db:migrate:names
// or from repo root -> node server/scripts/updateSchemaNames.js

const path = require("path");

// Try to load environment variables from potential locations
try {
  // server/.env
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch (_) {}
try {
  // repo root .env
  require("dotenv").config({
    path: path.resolve(__dirname, "..", "..", ".env"),
  });
} catch (_) {}

const pool = require("../lib/db");

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function ensureColumn(connection, table, column, ddl) {
  const hasTable = await tableExists(connection, table);
  if (!hasTable) {
    console.log(
      `- Skipping: table ${table} does not exist in database ${
        process.env.DB_NAME || "current DB"
      }`
    );
    return { changed: false, message: `Table ${table} missing` };
  }

  const exists = await columnExists(connection, table, column);
  if (exists) {
    console.log(`- OK: ${table}.${column} already exists`);
    return { changed: false, message: `${table}.${column} exists` };
  }

  console.log(`- Adding ${table}.${column} ...`);
  await connection.query(`ALTER TABLE \`${table}\` ${ddl}`);
  console.log(`  Added ${table}.${column}`);
  return { changed: true, message: `${table}.${column} added` };
}

async function run() {
  console.log("Starting DB migration for attendee name columns...");
  const connection = await pool.getConnection();
  try {
    const results = [];

    // tickets.user_name VARCHAR(255) NULL
    results.push(
      await ensureColumn(
        connection,
        "tickets",
        "user_name",
        "ADD COLUMN `user_name` VARCHAR(255) NULL AFTER `user_email`"
      )
    );

    // email_queue.to_name VARCHAR(255) NULL
    results.push(
      await ensureColumn(
        connection,
        "email_queue",
        "to_name",
        "ADD COLUMN `to_name` VARCHAR(255) NULL AFTER `to_email`"
      )
    );

    const changed = results.filter((r) => r.changed).length;
    console.log(`Migration complete. Columns changed: ${changed}.`);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
