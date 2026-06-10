import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('gymapp.db');
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = getDb();

  database.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      muscle_group TEXT,
      sets INTEGER DEFAULT 3,
      reps INTEGER DEFAULT 10,
      weight REAL DEFAULT 0,
      notes TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (routine_id) REFERENCES routines(id)
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sets_done INTEGER,
      reps_done INTEGER,
      weight_used REAL,
      logged_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      food_name TEXT NOT NULL,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      grams REAL DEFAULT 100,
      meal_type TEXT DEFAULT 'almuerzo',
      logged_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_planner (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      routine_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (routine_id) REFERENCES routines(id)
    );

    CREATE TABLE IF NOT EXISTS body_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      weight REAL,
      body_fat REAL,
      muscle_mass REAL,
      logged_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const existing = database.getFirstSync(
    'SELECT id FROM users WHERE username = ?',
    ['demo']
  );

  if (!existing) {
    database.runSync(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['demo', 'demo123', 'Usuario Demo', 'user']
    );
    database.runSync(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['carlos_fit', 'gym123', 'Carlos Fit', 'user']
    );
    database.runSync(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['trainer1', 'gym123', 'Coach Trainer', 'trainer']
    );
  }
}