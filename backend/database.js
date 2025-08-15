const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function init() {
  const dbPath = path.join(__dirname, 'class1admin.db');
  db = new sqlite3.Database(dbPath);
  
  // Create tables
  db.serialize(() => {
    // Instructors table
    db.run(`
      CREATE TABLE IF NOT EXISTS instructors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Students table
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        instructor_id TEXT,
        member_number TEXT UNIQUE,
        email TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instructor_id) REFERENCES instructors (id)
      )
    `);
    
    // Weekly checks table
    db.run(`
      CREATE TABLE IF NOT EXISTS weekly_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_key TEXT NOT NULL,
        student_id TEXT NOT NULL,
        dm BOOLEAN DEFAULT 0,
        dm_date TEXT,
        lesson BOOLEAN DEFAULT 0,
        lesson_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students (id),
        UNIQUE(week_key, student_id)
      )
    `);
    
    // Monthly checks table
    db.run(`
      CREATE TABLE IF NOT EXISTS monthly_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month_key TEXT NOT NULL,
        student_id TEXT NOT NULL,
        paid BOOLEAN DEFAULT 0,
        last_paid TEXT,
        survey BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students (id),
        UNIQUE(month_key, student_id)
      )
    `);
    
    // Surveys table
    db.run(`
      CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_number TEXT NOT NULL,
        student_name TEXT,
        satisfaction INTEGER,
        nps_score INTEGER,
        instructor_feedback TEXT,
        lesson_feedback TEXT,
        learning_goals TEXT,
        other_feedback TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Users table for authentication
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'instructor',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database initialized successfully');
  });
}

function getDb() {
  return db;
}

function close() {
  if (db) {
    db.close();
  }
}

module.exports = {
  init,
  getDb,
  close
}; 