const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function init() {
  // Render環境では永続化されたディレクトリを使用
  let dbPath;
  if (process.env.NODE_ENV === 'production') {
    // Renderの永続化ディレクトリを試す
    dbPath = '/tmp/class1admin.db';
    console.log('Using production database path:', dbPath);
  } else {
    dbPath = path.join(__dirname, 'class1admin.db');
    console.log('Using development database path:', dbPath);
  }
  
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
        registration_date TEXT,
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
    
    // 初期データの投入（データが空の場合のみ）
    insertInitialData();
  });
}

function insertInitialData() {
  // 講師データが空の場合、初期データを投入
  db.get('SELECT COUNT(*) as count FROM instructors', [], (err, row) => {
    if (err) {
      console.error('Error checking instructors count:', err);
      return;
    }
    
    if (row.count === 0) {
      console.log('Inserting initial instructor data...');
      const instructors = [
        { id: 'i_taichi', name: 'Taichi' },
        { id: 'i_takaya', name: 'Takaya' },
        { id: 'i_haruka', name: 'Haruka' }
      ];
      
      instructors.forEach(instructor => {
        db.run('INSERT INTO instructors (id, name) VALUES (?, ?)', 
          [instructor.id, instructor.name], (err) => {
          if (err) {
            console.error('Error inserting instructor:', err);
          } else {
            console.log(`Inserted instructor: ${instructor.name}`);
          }
        });
      });
    }
  });
  
  // 生徒データが空の場合、初期データを投入
  db.get('SELECT COUNT(*) as count FROM students', [], (err, row) => {
    if (err) {
      console.error('Error checking students count:', err);
      return;
    }
    
    if (row.count === 0) {
      console.log('Inserting initial student data...');
      const students = [
        { 
          id: 's_mohamed', 
          name: 'Mohamed Taqi', 
          instructor_id: 'i_taichi',
          member_number: 'k11',
          email: 'mt.taqi@gmail.com',
          note: ''
        },
        { 
          id: 's_test1', 
          name: 'test1', 
          instructor_id: 'i_takaya',
          member_number: 'k12',
          email: 'test1@gmail.com',
          note: '文化を学びたい'
        }
      ];
      
      students.forEach(student => {
        db.run('INSERT INTO students (id, name, instructor_id, member_number, email, note) VALUES (?, ?, ?, ?, ?, ?)', 
          [student.id, student.name, student.instructor_id, student.member_number, student.email, student.note], (err) => {
          if (err) {
            console.error('Error inserting student:', err);
          } else {
            console.log(`Inserted student: ${student.name}`);
          }
        });
      });
    }
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