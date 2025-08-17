const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function init() {
  console.log('=== 最小限SQLiteデータベース初期化開始 ===');
  
  try {
    // データベースパスの設定
    let dbPath;
    if (process.env.NODE_ENV === 'production') {
      dbPath = '/tmp/class1admin.db';
    } else {
      dbPath = path.join(__dirname, 'class1admin.db');
    }
    
    console.log('データベースパス:', dbPath);
    db = new sqlite3.Database(dbPath);
    
    console.log('=== データベース初期化完了 ===');
    
    // Create tables
    console.log('Creating database tables...');
    db.serialize(() => {
      // Instructors table
      db.run(`
        CREATE TABLE IF NOT EXISTS instructors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Instructors table error:', err);
        else console.log('Instructors table created');
      });
      
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Students table error:', err);
        else console.log('Students table created');
      });
      
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
          lesson_memo TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(week_key, student_id)
        )
      `, (err) => {
        if (err) console.error('Weekly checks table error:', err);
        else console.log('Weekly checks table created');
      });
      
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
          UNIQUE(month_key, student_id)
        )
      `, (err) => {
        if (err) console.error('Monthly checks table error:', err);
        else console.log('Monthly checks table created');
      });
      
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
      `, (err) => {
        if (err) console.error('Surveys table error:', err);
        else console.log('Surveys table created');
      });
      
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'instructor',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Users table error:', err);
        else {
          console.log('Users table created');
          console.log('All tables created successfully');
          
          // 初期データの投入
          insertInitialData();
        }
      });
    });
    
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

function insertInitialData() {
  console.log('Starting initial data insertion...');
  
  // 講師データの存在確認
  db.get('SELECT COUNT(*) as count FROM instructors', [], (err, row) => {
    if (err) {
      console.error('Error checking instructors:', err);
      return;
    }
    
    console.log('Current instructors count:', row.count);
    
    if (row.count === 0) {
      console.log('No instructors found, inserting initial data...');
      
      // 講師データを投入
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
      
      // 生徒データを投入
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
    } else {
      console.log('Instructors already exist, skipping insertion');
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

// ステータス取得
function getStatus() {
  return new Promise((resolve) => {
    try {
      const status = {
        databaseExists: true,
        databaseSize: 0,
        timestamp: new Date().toISOString()
      };
      
      if (db) {
        db.get('SELECT COUNT(*) as count FROM students', [], (err, row) => {
          if (!err && row) {
            status.studentCount = row.count;
          }
          resolve(status);
        });
      } else {
        resolve(status);
      }
    } catch (error) {
      resolve({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

module.exports = {
  init,
  getDb,
  close,
  getStatus
}; 