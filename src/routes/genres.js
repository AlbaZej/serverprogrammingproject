const express = require('express');
const { db } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/genres — Publicly accessible
router.get('/', (req, res) => {
  const genres = db.prepare('SELECT id, name, createdAt FROM genres ORDER BY name ASC').all();
  res.json({
    data: genres,
    meta: { total: genres.length }
  });
});

// POST /api/v1/genres — Admin only
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Genre name is required', details: [{ field: 'name', message: 'Name is required' }] }
    });
  }
  if (name.length > 100) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Genre name must be at most 100 characters', details: [{ field: 'name', message: 'Must be at most 100 characters' }] }
    });
  }

  const existing = db.prepare('SELECT id FROM genres WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Genre name already exists' }
    });
  }

  const result = db.prepare('INSERT INTO genres (name) VALUES (?)').run(name.trim());
  const genre = db.prepare('SELECT id, name, createdAt FROM genres WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ data: genre, meta: {} });
});

// PUT /api/v1/genres/:id — Admin only, full update
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const genre = db.prepare('SELECT * FROM genres WHERE id = ?').get(id);
  if (!genre) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Genre not found' }
    });
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Genre name is required', details: [{ field: 'name', message: 'Name is required' }] }
    });
  }
  if (name.length > 100) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Genre name must be at most 100 characters', details: [{ field: 'name', message: 'Must be at most 100 characters' }] }
    });
  }

  const existing = db.prepare('SELECT id FROM genres WHERE name = ? AND id != ?').get(name.trim(), id);
  if (existing) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Genre name already exists' }
    });
  }

  db.prepare('UPDATE genres SET name = ? WHERE id = ?').run(name.trim(), id);
  const updated = db.prepare('SELECT id, name, createdAt FROM genres WHERE id = ?').get(id);

  res.json({ data: updated, meta: {} });
});

// DELETE /api/v1/genres/:id — Admin only
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const genre = db.prepare('SELECT id FROM genres WHERE id = ?').get(id);
  if (!genre) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Genre not found' }
    });
  }

  const booksUsingGenre = db.prepare('SELECT COUNT(*) as count FROM books WHERE genreId = ?').get(id);
  if (booksUsingGenre.count > 0) {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Genre is in use by books and cannot be deleted' }
    });
  }

  db.prepare('DELETE FROM genres WHERE id = ?').run(id);
  res.status(204).send();
});

module.exports = router;
