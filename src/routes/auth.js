const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Validation
  const errors = [];
  if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
    errors.push({ field: 'firstName', message: 'First name is required' });
  } else if (firstName.length > 100) {
    errors.push({ field: 'firstName', message: 'First name must be at most 100 characters' });
  }
  if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  } else if (lastName.length > 100) {
    errors.push({ field: 'lastName', message: 'Last name must be at most 100 characters' });
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'A valid email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors }
    });
  }

  // Check for duplicate email
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Email already registered' }
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (firstName, lastName, email, password, role) VALUES (?, ?, ?, ?, ?)'
  ).run(firstName.trim(), lastName.trim(), email.toLowerCase(), hashedPassword, 'member');

  const user = db.prepare('SELECT id, firstName, lastName, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

  res.status(201).json({
    data: { token, user },
    meta: {}
  });
});

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const errors = [];
  if (!email || typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' });
  }
  if (!password || typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors }
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

  res.status(200).json({
    data: { token, expiresIn: 86400 },
    meta: {}
  });
});

module.exports = router;
