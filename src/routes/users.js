const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/users — Admin only, paginated list of users
router.get('/', authenticate, authorize('admin'), (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { role } = req.query;

  let countSql = 'SELECT COUNT(*) as total FROM users';
  let dataSql = 'SELECT id, firstName, lastName, email, role, createdAt, updatedAt FROM users';
  const params = [];

  if (role && ['member', 'admin'].includes(role)) {
    countSql += ' WHERE role = ?';
    dataSql += ' WHERE role = ?';
    params.push(role);
  }

  const { total } = db.prepare(countSql).get(...params);
  dataSql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  const users = db.prepare(dataSql).all(...params, limit, offset);

  res.json({
    data: users,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  });
});

// GET /api/v1/users/:id — Members can view own profile, admins can view any
router.get('/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You can only view your own profile' }
    });
  }

  const user = db.prepare('SELECT id, firstName, lastName, email, role, createdAt, updatedAt FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found' }
    });
  }

  res.json({ data: user, meta: {} });
});

// PATCH /api/v1/users/:id — Update user profile
router.patch('/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You can only update your own profile' }
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found' }
    });
  }

  const { firstName, lastName, email, password, role } = req.body;
  const errors = [];
  const updates = [];
  const values = [];

  if (firstName !== undefined) {
    if (typeof firstName !== 'string' || firstName.trim().length === 0 || firstName.length > 100) {
      errors.push({ field: 'firstName', message: 'First name must be 1-100 characters' });
    } else {
      updates.push('firstName = ?');
      values.push(firstName.trim());
    }
  }
  if (lastName !== undefined) {
    if (typeof lastName !== 'string' || lastName.trim().length === 0 || lastName.length > 100) {
      errors.push({ field: 'lastName', message: 'Last name must be 1-100 characters' });
    } else {
      updates.push('lastName = ?');
      values.push(lastName.trim());
    }
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: 'email', message: 'A valid email is required' });
    } else {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), id);
      if (existing) {
        return res.status(409).json({
          error: { code: 'CONFLICT', message: 'Email already taken' }
        });
      }
      updates.push('email = ?');
      values.push(email.toLowerCase());
    }
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
    } else {
      updates.push('password = ?');
      values.push(bcrypt.hashSync(password, 10));
    }
  }
  if (role !== undefined) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only admins can change roles' }
      });
    }
    if (!['member', 'admin'].includes(role)) {
      errors.push({ field: 'role', message: 'Role must be "member" or "admin"' });
    } else {
      updates.push('role = ?');
      values.push(role);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors }
    });
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' }
    });
  }

  updates.push("updatedAt = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT id, firstName, lastName, email, role, createdAt, updatedAt FROM users WHERE id = ?').get(id);
  res.json({ data: updated, meta: {} });
});

// DELETE /api/v1/users/:id — Admin only
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found' }
    });
  }

  const activeLoans = db.prepare('SELECT COUNT(*) as count FROM loans WHERE userId = ? AND status = ?').get(id, 'active');
  if (activeLoans.count > 0) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'User has active loans and cannot be deleted' }
    });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).send();
});

// GET /api/v1/users/:id/loans — Get a user's loans
router.get('/:id/loans', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You can only view your own loans' }
    });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found' }
    });
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { status } = req.query;

  let countSql = 'SELECT COUNT(*) as total FROM loans WHERE userId = ?';
  let dataSql = 'SELECT id, userId, bookId, borrowedAt, dueDate, returnedAt, status, createdAt, updatedAt FROM loans WHERE userId = ?';
  const params = [id];

  if (status && ['active', 'returned', 'overdue'].includes(status)) {
    countSql += ' AND status = ?';
    dataSql += ' AND status = ?';
    params.push(status);
  }

  const { total } = db.prepare(countSql).get(...params);
  dataSql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  const loans = db.prepare(dataSql).all(...params, limit, offset);

  res.json({
    data: loans,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  });
});

module.exports = router;
