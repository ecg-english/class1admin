const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// Set NODE_ENV for production
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Enable CORS
app.use(cors());
app.use(express.json());

// Database setup
let db;
const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/class1admin.db' : path.join(__dirname, 'class1admin.db');

console.log('=== 緊急サーバー起動 ===');
console.log('データベースパス:', dbPath);

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      db = new sqlite3.Database(dbPath);
      
      db.serialize(() => {
        // Create tables
        db.run(`
          CREATE TABLE IF NOT EXISTS instructors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
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
        `);
        
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
        `);
        
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
        `);
        
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
        
        // Insert initial data
        db.get('SELECT COUNT(*) as count FROM instructors', [], (err, row) => {
          if (!err && row.count === 0) {
            console.log('Inserting initial data...');
            
            const instructors = [
              { id: 'i_taichi', name: 'Taichi' },
              { id: 'i_takaya', name: 'Takaya' },
              { id: 'i_haruka', name: 'Haruka' }
            ];
            
            instructors.forEach(instructor => {
              db.run('INSERT INTO instructors (id, name) VALUES (?, ?)', [instructor.id, instructor.name]);
            });
            
            const students = [
              { id: 's_mohamed', name: 'Mohamed Taqi', instructor_id: 'i_taichi', member_number: 'k11', email: 'mt.taqi@gmail.com', note: '' },
              { id: 's_test1', name: 'test1', instructor_id: 'i_takaya', member_number: 'k12', email: 'test1@gmail.com', note: '文化を学びたい' }
            ];
            
            students.forEach(student => {
              db.run('INSERT INTO students (id, name, instructor_id, member_number, email, note) VALUES (?, ?, ?, ?, ?, ?)', 
                [student.id, student.name, student.instructor_id, student.member_number, student.email, student.note]);
            });
            
            console.log('Initial data inserted');
          }
          
          console.log('Database initialization completed');
          resolve();
        });
      });
      
    } catch (error) {
      console.error('Database initialization error:', error);
      reject(error);
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all instructors
app.get('/api/instructors', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  db.all('SELECT * FROM instructors ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add instructor
app.post('/api/instructors', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { name } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  
  const id = 'i_' + Math.random().toString(36).slice(2, 10);
  
  db.run('INSERT INTO instructors (id, name) VALUES (?, ?)', [id, name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id, name });
  });
});

// Get all students
app.get('/api/students', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const sql = `
    SELECT s.*, i.name as instructor_name 
    FROM students s 
    LEFT JOIN instructors i ON s.instructor_id = i.id 
    ORDER BY s.name
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add student
app.post('/api/students', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { name, instructorId, email, note, registrationDate } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  
  const id = 's_' + Math.random().toString(36).slice(2, 10);
  const memberNumber = 'k' + Math.floor(Math.random() * 100) + 11;
  
  db.run('INSERT INTO students (id, name, instructor_id, member_number, email, note, registration_date) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [id, name, instructorId, memberNumber, email, note, registrationDate], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({ 
      id, 
      name, 
      instructor_id: instructorId,
      member_number: memberNumber,
      email,
      note,
      registration_date: registrationDate
    });
  });
});

// Get weekly checks
app.get('/api/weekly/:weekKey', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { weekKey } = req.params;
  
  db.all('SELECT * FROM weekly_checks WHERE week_key = ?', [weekKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const weeklyData = {};
    rows.forEach(row => {
      weeklyData[row.student_id] = {
        dm: Boolean(row.dm),
        dmDate: row.dm_date || '',
        lesson: Boolean(row.lesson),
        lessonDate: row.lesson_date || '',
        lessonMemo: row.lesson_memo || ''
      };
    });
    
    res.json(weeklyData);
  });
});

// Update weekly check
app.post('/api/weekly', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { weekKey, studentId, dm, dmDate, lesson, lessonDate, lessonMemo } = req.body;
  
  if (!weekKey || !studentId) {
    res.status(400).json({ error: 'Week key and student ID are required' });
    return;
  }
  
  const sql = `
    INSERT OR REPLACE INTO weekly_checks (week_key, student_id, dm, dm_date, lesson, lesson_date, lesson_memo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [weekKey, studentId, dm ? 1 : 0, dmDate, lesson ? 1 : 0, lessonDate, lessonMemo || ''], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ weekKey, studentId, dm, dmDate, lesson, lessonDate, lessonMemo: lessonMemo || '' });
  });
});

// Get monthly checks
app.get('/api/monthly/:monthKey', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { monthKey } = req.params;
  
  db.all('SELECT * FROM monthly_checks WHERE month_key = ?', [monthKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const monthlyData = {};
    rows.forEach(row => {
      monthlyData[row.student_id] = {
        paid: Boolean(row.paid),
        lastPaid: row.last_paid || '',
        survey: Boolean(row.survey)
      };
    });
    
    res.json(monthlyData);
  });
});

// Update monthly check
app.post('/api/monthly', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { monthKey, studentId, paid, lastPaid, survey } = req.body;
  
  if (!monthKey || !studentId) {
    res.status(400).json({ error: 'Month key and student ID are required' });
    return;
  }
  
  const sql = `
    INSERT OR REPLACE INTO monthly_checks (month_key, student_id, paid, last_paid, survey)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [monthKey, studentId, paid ? 1 : 0, lastPaid, survey ? 1 : 0], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ monthKey, studentId, paid, lastPaid, survey });
  });
});

// Get surveys
app.get('/api/surveys', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  db.all('SELECT * FROM surveys ORDER BY submitted_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Submit survey
app.post('/api/surveys', (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return;
  }
  
  const { memberNumber, studentName, satisfaction, npsScore, instructorFeedback, lessonFeedback, learningGoals, otherFeedback } = req.body;
  
  if (!memberNumber) {
    res.status(400).json({ error: 'Member number is required' });
    return;
  }
  
  const sql = `
    INSERT INTO surveys (member_number, student_name, satisfaction, nps_score, instructor_feedback, lesson_feedback, learning_goals, other_feedback)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [memberNumber, studentName, satisfaction, npsScore, instructorFeedback, lessonFeedback, learningGoals, otherFeedback], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, memberNumber, studentName });
  });
});

// Start server
const PORT = process.env.PORT || 10000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Emergency server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  // エラーが発生してもサーバーは起動
  app.listen(PORT, () => {
    console.log(`Emergency server running on port ${PORT} (database error)`);
  });
}); 