const express = require('express');
const { db } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/books — Paginated list, publicly accessible
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (req.query.genre) {
    conditions.push('g.name LIKE ?');
    params.push(`%${req.query.genre}%`);
  }
  if (req.query.author) {
    conditions.push('b.author LIKE ?');
    params.push(`%${req.query.author}%`);
  }
  if (req.query.title) {
    conditions.push('b.title LIKE ?');
    params.push(`%${req.query.title}%`);
  }
  if (req.query.available === 'true') {
    conditions.push('b.availableCopies > 0');
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { total } = db.prepare(
    `SELECT COUNT(*) as total FROM books b LEFT JOIN genres g ON b.genreId = g.id ${whereClause}`
  ).get(...params);

  // Sorting
  const validSortFields = ['title', 'author', 'publishedYear', 'createdAt'];
  let orderClause = 'ORDER BY b.id ASC';
  if (req.query.sort) {
    const desc = req.query.sort.startsWith('-');
    const field = desc ? req.query.sort.slice(1) : req.query.sort;
    if (validSortFields.includes(field)) {
      orderClause = `ORDER BY b.${field} ${desc ? 'DESC' : 'ASC'}`;
    }
  }

  const books = db.prepare(
    `SELECT b.id, b.title, b.author, b.isbn, b.genreId, g.name as genre, b.totalCopies, b.availableCopies, b.publishedYear, b.createdAt, b.updatedAt
     FROM books b LEFT JOIN genres g ON b.genreId = g.id
     ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({
    data: books,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  });
});

// GET /api/v1/books/:id — Single book, publicly accessible
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const book = db.prepare(
    `SELECT b.id, b.title, b.author, b.isbn, b.genreId, g.name as genre, b.totalCopies, b.availableCopies, b.publishedYear, b.createdAt, b.updatedAt
     FROM books b LEFT JOIN genres g ON b.genreId = g.id WHERE b.id = ?`
  ).get(id);

  if (!book) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Book not found' }
    });
  }

  res.json({ data: book, meta: {} });
});

// POST /api/v1/books — Admin only
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { title, author, isbn, genreId, totalCopies, publishedYear } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required' });
  } else if (title.length > 255) {
    errors.push({ field: 'title', message: 'Title must be at most 255 characters' });
  }
  if (!author || typeof author !== 'string' || author.trim().length === 0) {
    errors.push({ field: 'author', message: 'Author is required' });
  } else if (author.length > 255) {
    errors.push({ field: 'author', message: 'Author must be at most 255 characters' });
  }
  if (!isbn || typeof isbn !== 'string' || isbn.trim().length === 0) {
    errors.push({ field: 'isbn', message: 'ISBN is required' });
  }
  if (!genreId || typeof genreId !== 'number') {
    errors.push({ field: 'genreId', message: 'Genre ID is required and must be a number' });
  }
  if (!totalCopies || typeof totalCopies !== 'number' || totalCopies < 1) {
    errors.push({ field: 'totalCopies', message: 'Total copies must be at least 1' });
  }
  if (publishedYear !== undefined && publishedYear !== null) {
    if (typeof publishedYear !== 'number' || publishedYear < 1000 || publishedYear > 9999) {
      errors.push({ field: 'publishedYear', message: 'Published year must be a 4-digit year' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors }
    });
  }

  // Check genre exists
  const genre = db.prepare('SELECT id FROM genres WHERE id = ?').get(genreId);
  if (!genre) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Genre not found' }
    });
  }

  // Check ISBN uniqueness
  const existingBook = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn.trim());
  if (existingBook) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'ISBN already exists' }
    });
  }

  const result = db.prepare(
    'INSERT INTO books (title, author, isbn, genreId, totalCopies, availableCopies, publishedYear) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title.trim(), author.trim(), isbn.trim(), genreId, totalCopies, totalCopies, publishedYear || null);

  const book = db.prepare(
    `SELECT b.id, b.title, b.author, b.isbn, b.genreId, g.name as genre, b.totalCopies, b.availableCopies, b.publishedYear, b.createdAt, b.updatedAt
     FROM books b LEFT JOIN genres g ON b.genreId = g.id WHERE b.id = ?`
  ).get(result.lastInsertRowid);

  res.status(201).json({ data: book, meta: {} });
});

// PATCH /api/v1/books/:id — Admin only
router.patch('/:id', authenticate, authorize('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!book) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Book not found' }
    });
  }

  const { title, author, totalCopies, genreId, publishedYear } = req.body;
  const errors = [];
  const updates = [];
  const values = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 255) {
      errors.push({ field: 'title', message: 'Title must be 1-255 characters' });
    } else {
      updates.push('title = ?');
      values.push(title.trim());
    }
  }
  if (author !== undefined) {
    if (typeof author !== 'string' || author.trim().length === 0 || author.length > 255) {
      errors.push({ field: 'author', message: 'Author must be 1-255 characters' });
    } else {
      updates.push('author = ?');
      values.push(author.trim());
    }
  }
  if (totalCopies !== undefined) {
    if (typeof totalCopies !== 'number' || totalCopies < 1) {
      errors.push({ field: 'totalCopies', message: 'Total copies must be at least 1' });
    } else {
      const borrowedCopies = book.totalCopies - book.availableCopies;
      if (totalCopies < borrowedCopies) {
        errors.push({ field: 'totalCopies', message: `Total copies cannot be less than currently borrowed count (${borrowedCopies})` });
      } else {
        const newAvailable = totalCopies - borrowedCopies;
        updates.push('totalCopies = ?', 'availableCopies = ?');
        values.push(totalCopies, newAvailable);
      }
    }
  }
  if (genreId !== undefined) {
    if (typeof genreId !== 'number') {
      errors.push({ field: 'genreId', message: 'Genre ID must be a number' });
    } else {
      const genre = db.prepare('SELECT id FROM genres WHERE id = ?').get(genreId);
      if (!genre) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Genre not found' }
        });
      }
      updates.push('genreId = ?');
      values.push(genreId);
    }
  }
  if (publishedYear !== undefined) {
    if (publishedYear !== null && (typeof publishedYear !== 'number' || publishedYear < 1000 || publishedYear > 9999)) {
      errors.push({ field: 'publishedYear', message: 'Published year must be a 4-digit year' });
    } else {
      updates.push('publishedYear = ?');
      values.push(publishedYear);
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
  db.prepare(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(
    `SELECT b.id, b.title, b.author, b.isbn, b.genreId, g.name as genre, b.totalCopies, b.availableCopies, b.publishedYear, b.createdAt, b.updatedAt
     FROM books b LEFT JOIN genres g ON b.genreId = g.id WHERE b.id = ?`
  ).get(id);

  res.json({ data: updated, meta: {} });
});

// DELETE /api/v1/books/:id — Admin only
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(id);
  if (!book) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Book not found' }
    });
  }

  const activeLoans = db.prepare('SELECT COUNT(*) as count FROM loans WHERE bookId = ? AND status = ?').get(id, 'active');
  if (activeLoans.count > 0) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Book has active loans and cannot be deleted' }
    });
  }

  db.prepare('DELETE FROM books WHERE id = ?').run(id);
  res.status(204).send();
});

module.exports = router;
