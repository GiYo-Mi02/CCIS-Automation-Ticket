const express = require("express");
const { requireAuth, supabaseAuth } = require("../middleware/auth");
const pool = require("../lib/db");
const { findAuthorizedAdminByEmail, normalizeEmail } = require("../lib/authEmail");

const router = express.Router();

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile info.
 * Requires a valid Bearer token.
 */
router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: req.user,
  });
});

/**
 * POST /api/auth/check-access
 * Body: { email }
 * Checks whether a given email is in the authorized_admins whitelist.
 * This is called by the frontend right after Google sign-in to decide
 * whether to allow the user in or sign them out.
 *
 * NOTE: This route is semi-public — it still verifies the Supabase JWT
 * but doesn't require the email to already be in the whitelist.
 */
router.post("/check-access", async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.slice(7).trim();

  try {
    // Verify the token is real
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

    const evaluatedEmail = normalizeEmail(user.email || req.body?.email || "");
    const { row } = await findAuthorizedAdminByEmail(pool, evaluatedEmail);

    if (!row) {
      return res.json({
        authorized: false,
        email: evaluatedEmail,
        message: `This email is not authorized to access the CCIS Admin Console: ${evaluatedEmail}`,
      });
    }

    // If the display_name is empty and we got a name from Google, update it
    const googleName =
      user.user_metadata?.full_name || user.user_metadata?.name || null;

    if (googleName && !row.display_name) {
      await pool.query(
        "UPDATE authorized_admins SET display_name = ? WHERE id = ?",
        [googleName, row.id]
      );
    }

    return res.json({
      authorized: true,
      email: row.email,
      role: row.role,
      displayName: row.display_name || googleName || evaluatedEmail,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
