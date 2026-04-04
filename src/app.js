const express = require('express');
const requestLogger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookRoutes = require('./routes/books');
const loanRoutes = require('./routes/loans');
const genreRoutes = require('./routes/genres');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Log every request
app.use(requestLogger);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/books', bookRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/genres', genreRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
