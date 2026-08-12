function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || "Internal server error"
  });
}

module.exports = { notFound, errorHandler };

