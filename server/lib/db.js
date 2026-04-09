const { Pool } = require("pg");

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSupabaseDbConfig() {
  const connectionString = process.env.SUPABASE_DB_URL;
  const shouldUseSsl =
    String(process.env.SUPABASE_DB_SSL_MODE || "require").toLowerCase() !==
    "disable";

  if (!connectionString) {
    throw new Error(
      "SUPABASE_DB_URL is required. Use your Supabase Transaction Pooler connection string."
    );
  }

  let dbHost = "";
  try {
    dbHost = new URL(connectionString).hostname;
  } catch (err) {
    throw new Error("SUPABASE_DB_URL is not a valid connection string");
  }

  const isSupabaseHost =
    dbHost === "supabase.co" ||
    dbHost.endsWith(".supabase.co") ||
    dbHost === "supabase.com" ||
    dbHost.endsWith(".supabase.com");

  if (!isSupabaseHost) {
    throw new Error(
      "SUPABASE_DB_URL must point to a Supabase host (.supabase.co or .supabase.com)"
    );
  }

  return {
    connectionString,
    max: toNumber(process.env.SUPABASE_DB_POOL_MAX, 10),
    application_name:
      process.env.SUPABASE_DB_APP_NAME || "ccis-ticketing-supabase",
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  };
}

const supabasePool = new Pool(buildSupabaseDbConfig());

function normalizeSqlAndParams(sql, params = []) {
  if (!Array.isArray(params) || params.length === 0) {
    return { text: sql, values: [] };
  }

  let idx = 0;
  const values = [];
  const text = String(sql).replace(/\?/g, () => {
    const value = params[idx++];

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "NULL";
      }

      const placeholders = value.map((item) => {
        values.push(item);
        return `$${values.length}`;
      });
      return placeholders.join(", ");
    }

    values.push(value === undefined ? null : value);
    return `$${values.length}`;
  });

  return { text, values };
}

function shouldAppendReturningId(sql) {
  return /^\s*insert\s+/i.test(sql) && !/\breturning\b/i.test(sql);
}

function formatResult(sql, result) {
  if (/^\s*select\s+/i.test(sql) || /^\s*with\s+/i.test(sql)) {
    return [result.rows];
  }

  if (/^\s*insert\s+/i.test(sql)) {
    const insertId = result.rows?.[0]?.id ?? null;
    return [
      {
        insertId,
        affectedRows: result.rowCount,
        rowCount: result.rowCount,
      },
    ];
  }

  return [
    {
      affectedRows: result.rowCount,
      rowCount: result.rowCount,
    },
  ];
}

async function runQuery(executor, sql, params = []) {
  const normalized = normalizeSqlAndParams(sql, params);
  const text = shouldAppendReturningId(normalized.text)
    ? `${normalized.text} RETURNING id`
    : normalized.text;
  const result = await executor.query(text, normalized.values);
  return formatResult(sql, result);
}

const pool = {
  query(sql, params) {
    return runQuery(supabasePool, sql, params);
  },
  async getConnection() {
    const client = await supabasePool.connect();

    return {
      beginTransaction() {
        return client.query("BEGIN");
      },
      query(sql, params) {
        return runQuery(client, sql, params);
      },
      commit() {
        return client.query("COMMIT");
      },
      rollback() {
        return client.query("ROLLBACK");
      },
      release() {
        client.release();
      },
    };
  },
  end() {
    return supabasePool.end();
  },
};

module.exports = pool;
