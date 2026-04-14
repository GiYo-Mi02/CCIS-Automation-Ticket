const { createClient } = require("@supabase/supabase-js");
const pool = require("../lib/db");
const {
  findAuthorizedAdminByEmail,
  normalizeEmail,
} = require("../lib/authEmail");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAuthKey = supabaseAnonKey || supabaseServiceKey;

if (!supabaseUrl || !supabaseAuthKey) {
  console.error(
    "SUPABASE_URL and (SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY) must be set in .env"
  );
}

// A regular project key (anon/service-role) is enough for auth.getUser(token)
const supabaseAuth = createClient(supabaseUrl, supabaseAuthKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Express middleware: verifies the Supabase JWT from the Authorization header,
 * then checks the user's email against the authorized_admins table.
 *
 * On success attaches `req.user` with { id, email, role }.
 * On failure responds with 401 (no/bad token) or 403 (not whitelisted).
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query?.access_token === "string"
    ? req.query.access_token.trim()
    : "";

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim(); // strip "Bearer "
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token" });
  }

  try {
    // 1. Verify the JWT with Supabase
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);

    if (error) {
      if (/invalid api key/i.test(error.message || "")) {
        return res.status(500).json({ error: "Server auth configuration is invalid" });
      }
    }

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const email = normalizeEmail(user.email);

    if (!email) {
      return res.status(401).json({ error: "Token has no associated email" });
    }

    // 2. Check whitelist
    const { row } = await findAuthorizedAdminByEmail(pool, email);

    if (!row) {
      return res.status(403).json({
        error: `Access denied - your email is not authorized to use this system: ${email}`,
      });
    }

    // 3. Attach user info for downstream handlers
    req.user = {
      supabaseId: user.id,
      email: row.email,
      role: row.role || "admin",
      adminId: row.id,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication service unavailable" });
  }
}

module.exports = { requireAuth, supabaseAuth };
