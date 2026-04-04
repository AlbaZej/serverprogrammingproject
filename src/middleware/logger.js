const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '..', '..', 'requests.log');

function requestLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${req.method} ${req.originalUrl}\n`;

  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err.message);
    }
  });

  next();
}

module.exports = requestLogger;
