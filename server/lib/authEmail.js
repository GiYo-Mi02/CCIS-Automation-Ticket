function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function canonicalizeEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized) return "";

  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return normalized;
  }

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const canonicalLocal = localPart.replace(/\+.*/, "");

  return `${canonicalLocal}@${domain}`;
}

async function findAuthorizedAdminByEmail(pool, rawEmail) {
  const normalized = normalizeEmail(rawEmail);
  const canonical = canonicalizeEmail(normalized);

  if (!normalized) {
    return { row: null, normalized, canonical };
  }

  const [rows] = await pool.query(
    `SELECT id, email, role, display_name
       FROM authorized_admins
      WHERE LOWER(BTRIM(email)) = ?
         OR LOWER(BTRIM(email)) = ?
      ORDER BY id ASC
      LIMIT 1`,
    [normalized, canonical]
  );

  return {
    row: rows?.[0] || null,
    normalized,
    canonical,
  };
}

module.exports = {
  normalizeEmail,
  canonicalizeEmail,
  findAuthorizedAdminByEmail,
};
