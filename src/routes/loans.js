const express = require('express');
const { db } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/loans — Members see own loans, admins see all
router.get('/', authenticate, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { status } = req.query;

  const isAdmin = req.user.role === 'admin';
  const conditions = [];
  const params = [];

  if (!isAdmin) {
    conditions.push('l.userId = ?');
    params.push(req.user.id);
  }

  if (status && ['active', 'returned', 'overdue'].includes(status)) {
    conditions.push('l.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM loans l ${whereClause}`).get(...params);

  const loans = db.prepare(
    `SELECT l.id, l.userId, l.bookId, l.borrowedAt, l.dueDate, l.returnedAt, l.status, l.createdAt, l.updatedAt
     FROM loans l ${whereClause} ORDER BY l.id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({
    data: loans,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  });
});

// POST /api/v1/loans — Borrow a book
router.post('/', authenticate, (req, res) => {
  const { bookId } = req.body;

  if (!bookId || typeof bookId !== 'number') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'bookId is required and must be a number', details: [{ field: 'bookId', message: 'bookId is required' }] }
    });
  }

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Book not found' }
    });
  }

  if (book.availableCopies < 1) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'No copies available' }
    });
  }

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 14);

  const borrowedAt = now.toISOString();
  const dueDateStr = dueDate.toISOString();

  const createLoan = db.transaction(() => {
    db.prepare('UPDATE books SET availableCopies = availableCopies - 1 WHERE id = ?').run(bookId);
    const result = db.prepare(
      'INSERT INTO loans (userId, bookId, borrowedAt, dueDate, status) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, bookId, borrowedAt, dueDateStr, 'active');
    return result.lastInsertRowid;
  });

  const loanId = createLoan();
  const loan = db.prepare('SELECT id, userId, bookId, borrowedAt, dueDate, returnedAt, status, createdAt, updatedAt FROM loans WHERE id = ?').get(loanId);

  res.status(201).json({ data: loan, meta: {} });
});

// PATCH /api/v1/loans/:id — Return a book
router.patch('/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const { returned } = req.body;

  if (returned !== true) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Field "returned" must be true', details: [{ field: 'returned', message: 'Must be true' }] }
    });
  }

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  if (!loan) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Loan not found' }
    });
  }

  if (req.user.role !== 'admin' && req.user.id !== loan.userId) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You can only return your own loans' }
    });
  }

  if (loan.status === 'returned') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Loan already returned' }
    });
  }

  const returnedAt = new Date().toISOString();

  const returnBook = db.transaction(() => {
    db.prepare(
      "UPDATE loans SET returnedAt = ?, status = 'returned', updatedAt = datetime('now') WHERE id = ?"
    ).run(returnedAt, id);
    db.prepare('UPDATE books SET availableCopies = availableCopies + 1 WHERE id = ?').run(loan.bookId);
  });

  returnBook();

  const updated = db.prepare('SELECT id, userId, bookId, borrowedAt, dueDate, returnedAt, status, createdAt, updatedAt FROM loans WHERE id = ?').get(id);
  res.json({ data: updated, meta: {} });
});

module.exports = router;
