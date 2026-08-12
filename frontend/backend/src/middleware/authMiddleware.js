/**
 * Auth middleware — JWT verification (placeholder)
 * 
 * Currently a pass-through for backward compatibility.
 * When JWT is implemented, this will:
 * 1. Extract JWT from Authorization header or httpOnly cookie
 * 2. Verify and decode the token
 * 3. Attach user info to req.user
 * 4. Reject unauthorized requests
 * 
 * Usage:
 *   const { requireAuth, optionalAuth } = require("../middleware/authMiddleware");
 *   router.get("/protected", requireAuth, handler);
 *   router.get("/optional", optionalAuth, handler);
 */

/**
 * requireAuth — blocks request if not authenticated
 * TODO: Implement JWT verification when jsonwebtoken is added
 */
function requireAuth(req, res, next) {
  // Placeholder: Check for userId in query/body/header
  const userId =
    req.headers["x-user-id"] ||
    req.query.userId ||
    req.body?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  req.userId = Number(userId);
  next();
}

/**
 * optionalAuth — attaches user info if token present, otherwise continues
 * TODO: Implement JWT verification when jsonwebtoken is added
 */
function optionalAuth(req, res, next) {
  const userId =
    req.headers["x-user-id"] ||
    req.query.userId ||
    req.body?.userId;

  if (userId) {
    req.userId = Number(userId);
  }

  next();
}

module.exports = { requireAuth, optionalAuth };
