const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'library.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member', 'admin')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT NOT NULL UNIQUE,
      genreId INTEGER NOT NULL,
      totalCopies INTEGER NOT NULL CHECK(totalCopies >= 1),
      availableCopies INTEGER NOT NULL,
      publishedYear INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (genreId) REFERENCES genres(id)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      bookId INTEGER NOT NULL,
      borrowedAt TEXT NOT NULL DEFAULT (datetime('now')),
      dueDate TEXT NOT NULL,
      returnedAt TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'returned', 'overdue')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );
  `);
}

module.exports = { db, initialize };
