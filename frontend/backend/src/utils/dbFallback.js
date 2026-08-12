const DB_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ER_BAD_DB_ERROR",
  "ER_ACCESS_DENIED_ERROR",
  "PROTOCOL_CONNECTION_LOST"
]);

function isDbUnavailable(error) {
  if (!error) return false;

  // Check raw node or database driver error codes
  if (error.code && DB_UNAVAILABLE_CODES.has(error.code)) {
    return true;
  }

  // Check Prisma error codes (Prisma connection/initialization/validation errors start with P1)
  if (typeof error.code === "string" && error.code.startsWith("P1")) {
    return true;
  }

  // Check error message/stack for database connection/missing env issues
  const message = error.message || "";
  if (
    message.includes("Environment variable not found") ||
    message.includes("DATABASE_URL") ||
    message.includes("Can't reach database server") ||
    message.includes("Authentication failed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Initialization error")
  ) {
    return true;
  }

  return false;
}

module.exports = { isDbUnavailable };

