function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  });
}

module.exports = errorHandler;
