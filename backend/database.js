const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function init() {
  // Render環境では永続化されたディレクトリを使用
  let dbPath;
  const fs = require('fs');
  
  if (process.env.NODE_ENV === 'production') {
    // より多くの永続化ディレクトリを試す
    const possiblePaths = [
      '/tmp/class1admin.db',
      '/opt/render/project/src/class1admin.db',
      '/app/class1admin.db',
      '/var/tmp/class1admin.db',
      '/home/render/class1admin.db',
      process.env.HOME + '/class1admin.db'
    ].filter(p => p); // undefinedを除外
    
    console.log('Searching for existing database in paths:', possiblePaths);
    
    // 既存のデータベースファイルを探す
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        dbPath = path;
        console.log('Found existing database at:', dbPath);
        console.log('Database size:', fs.statSync(dbPath).size, 'bytes');
        break;
      }
    }
    
    // 見つからない場合は/tmpに作成
    if (!dbPath) {
      dbPath = '/tmp/class1admin.db';
      console.log('No existing database found, creating new one at:', dbPath);
    }
  } else {
    dbPath = path.join(__dirname, 'class1admin.db');
    console.log('Using development database path:', dbPath);
  }
  
  db = new sqlite3.Database(dbPath);
  
  // より強固なバックアップ・復元システム（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    const backupPaths = [
      '/tmp/class1admin_backup.db',
      '/opt/render/project/src/class1admin_backup.db',
      '/app/class1admin_backup.db'
    ];
    
    // バックアップからの復元を試行
    let restored = false;
    for (const backupPath of backupPaths) {
      if (fs.existsSync(backupPath) && !fs.existsSync(dbPath)) {
        try {
          fs.copyFileSync(backupPath, dbPath);
          console.log('Database restored from backup:', backupPath);
          restored = true;
          break;
        } catch (error) {
          console.error('Failed to restore from backup:', backupPath, error);
        }
      }
    }
    
    if (!restored) {
      console.log('No backup found or restore failed, will create new database');
    }
  }
  
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
    console.log('Database file path:', dbPath);
    console.log('Database file size:', fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 'N/A', 'bytes');
    
    // 初期データの投入（データが空の場合のみ）
    // 本番環境でのみ実行し、開発環境ではスキップ
    if (process.env.NODE_ENV === 'production') {
      insertInitialData();
    }
  });
}

function insertInitialData() {
  console.log('Starting initial data insertion...');
  
  // データベースが完全に空の場合のみ初期データを投入
  db.get('SELECT COUNT(*) as total FROM (SELECT 1 FROM instructors UNION SELECT 1 FROM students)', [], (err, row) => {
    if (err) {
      console.error('Error checking database state:', err);
      return;
    }
    
    console.log('Total records in database:', row.total);
    
    if (row.total === 0) {
      console.log('Database is completely empty, inserting initial data...');
      
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
      console.log('Database has existing data, skipping initial data insertion');
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

// データベースの定期バックアップ（複数バックアップ）
function backupDatabase() {
  if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');
    const currentDbPath = '/tmp/class1admin.db';
    const backupPaths = [
      '/tmp/class1admin_backup.db',
      '/opt/render/project/src/class1admin_backup.db',
      '/app/class1admin_backup.db'
    ];
    
    if (fs.existsSync(currentDbPath)) {
      let successCount = 0;
      for (const backupPath of backupPaths) {
        try {
          fs.copyFileSync(currentDbPath, backupPath);
          console.log('Database backup created at:', backupPath);
          successCount++;
        } catch (error) {
          console.error('Failed to create database backup at:', backupPath, error);
        }
      }
      console.log(`Database backup completed: ${successCount}/${backupPaths.length} locations`);
    } else {
      console.warn('Current database file not found for backup');
    }
  }
}

// より頻繁なバックアップ（2分ごと）
if (process.env.NODE_ENV === 'production') {
  setInterval(backupDatabase, 2 * 60 * 1000);
}

module.exports = {
  init,
  getDb,
  close,
  backupDatabase
}; 