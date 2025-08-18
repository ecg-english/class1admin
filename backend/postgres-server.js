const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Set NODE_ENV for production
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Enable CORS
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'class1admin',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('=== PostgreSQLサーバー起動 ===');
console.log('接続情報:', {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  port: process.env.DB_PORT
});

// Initialize database
async function initDatabase() {
  try {
    const client = await pool.connect();
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS instructors (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        instructor_id VARCHAR(50),
        member_number VARCHAR(20) UNIQUE,
        email VARCHAR(100),
        note TEXT,
        registration_date VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_checks (
        id SERIAL PRIMARY KEY,
        week_key VARCHAR(20) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        dm BOOLEAN DEFAULT FALSE,
        dm_date VARCHAR(20),
        lesson BOOLEAN DEFAULT FALSE,
        lesson_date VARCHAR(20),
        lesson_memo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(week_key, student_id)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_checks (
        id SERIAL PRIMARY KEY,
        month_key VARCHAR(20) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        paid BOOLEAN DEFAULT FALSE,
        last_paid VARCHAR(20),
        survey BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month_key, student_id)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        member_number VARCHAR(20) NOT NULL,
        student_name VARCHAR(100),
        satisfaction INTEGER,
        nps_score INTEGER,
        instructor_feedback TEXT,
        lesson_feedback TEXT,
        learning_goals TEXT,
        other_feedback TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if initial data exists
    const instructorResult = await client.query('SELECT COUNT(*) FROM instructors');
    const instructorCount = parseInt(instructorResult.rows[0].count);
    
    if (instructorCount === 0) {
      console.log('Inserting initial data...');
      
      // Insert initial instructors
      const instructors = [
        { id: 'i_taichi', name: 'Taichi' },
        { id: 'i_takaya', name: 'Takaya' },
        { id: 'i_haruka', name: 'Haruka' }
      ];
      
      for (const instructor of instructors) {
        await client.query(
          'INSERT INTO instructors (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
          [instructor.id, instructor.name]
        );
      }
      
      // Insert initial students
      const students = [
        { id: 's_mohamed', name: 'Mohamed Taqi', instructor_id: 'i_taichi', member_number: 'k11', email: 'mt.taqi@gmail.com', note: '' },
        { id: 's_test1', name: 'test1', instructor_id: 'i_takaya', member_number: 'k12', email: 'test1@gmail.com', note: '文化を学びたい' }
      ];
      
      for (const student of students) {
        await client.query(
          'INSERT INTO students (id, name, instructor_id, member_number, email, note) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [student.id, student.name, student.instructor_id, student.member_number, student.email, student.note]
        );
      }
      
      console.log('Initial data inserted');
    } else {
      console.log('Initial data already exists');
    }
    
    client.release();
    console.log('Database initialization completed');
    
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all instructors
app.get('/api/instructors', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM instructors ORDER BY name');
    client.release();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add instructor
app.post('/api/instructors', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    
    const id = 'i_' + Math.random().toString(36).slice(2, 10);
    const client = await pool.connect();
    
    await client.query('INSERT INTO instructors (id, name) VALUES ($1, $2)', [id, name]);
    client.release();
    
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT s.*, i.name as instructor_name 
      FROM students s 
      LEFT JOIN instructors i ON s.instructor_id = i.id 
      ORDER BY s.name
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add student
app.post('/api/students', async (req, res) => {
  try {
    const { name, instructorId, email, note, registrationDate } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    
    const id = 's_' + Math.random().toString(36).slice(2, 10);
    const memberNumber = 'k' + Math.floor(Math.random() * 100) + 11;
    
    const client = await pool.connect();
    
    const result = await client.query(
      'INSERT INTO students (id, name, instructor_id, member_number, email, note, registration_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, name, instructorId, memberNumber, email, note, registrationDate]
    );
    
    client.release();
    
    const student = result.rows[0];
    res.json({ 
      id: student.id, 
      name: student.name, 
      instructor_id: student.instructor_id,
      member_number: student.member_number,
      email: student.email,
      note: student.note,
      registration_date: student.registration_date
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, instructorId, email, note, registrationDate } = req.body;
    
    const client = await pool.connect();
    
    // Get existing student data
    const existingResult = await client.query('SELECT * FROM students WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      client.release();
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    const existingStudent = existingResult.rows[0];
    
    // Prepare update data (use existing data if not provided)
    const updateData = {
      name: name || existingStudent.name,
      instructor_id: instructorId || existingStudent.instructor_id,
      email: email !== undefined ? email : existingStudent.email,
      note: note !== undefined ? note : existingStudent.note,
      registration_date: registrationDate || existingStudent.registration_date
    };
    
    // Update database
    await client.query(
      'UPDATE students SET name = $1, instructor_id = $2, email = $3, note = $4, registration_date = $5 WHERE id = $6',
      [updateData.name, updateData.instructor_id, updateData.email, updateData.note, updateData.registration_date, id]
    );
    
    // Get updated student data
    const result = await client.query(`
      SELECT s.*, i.name as instructor_name 
      FROM students s 
      LEFT JOIN instructors i ON s.instructor_id = i.id 
      WHERE s.id = $1
    `, [id]);
    
    client.release();
    
    const student = result.rows[0];
    res.json({
      id: student.id,
      name: student.name,
      instructor_id: student.instructor_id,
      instructorId: student.instructor_id, // for backward compatibility
      member_number: student.member_number,
      memberNumber: student.member_number, // for backward compatibility
      email: student.email,
      note: student.note,
      registration_date: student.registration_date,
      registrationDate: student.registration_date, // for backward compatibility
      created_at: student.created_at,
      instructor_name: student.instructor_name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    const result = await client.query('DELETE FROM students WHERE id = $1', [id]);
    client.release();
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weekly checks
app.get('/api/weekly/:weekKey', async (req, res) => {
  try {
    const { weekKey } = req.params;
    const client = await pool.connect();
    
    const result = await client.query('SELECT * FROM weekly_checks WHERE week_key = $1', [weekKey]);
    client.release();
    
    const weeklyData = {};
    result.rows.forEach(row => {
      weeklyData[row.student_id] = {
        dm: Boolean(row.dm),
        dmDate: row.dm_date || '',
        lesson: Boolean(row.lesson),
        lessonDate: row.lesson_date || '',
        lessonMemo: row.lesson_memo || ''
      };
    });
    
    res.json(weeklyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update weekly check
app.post('/api/weekly', async (req, res) => {
  try {
    const { weekKey, studentId, dm, dmDate, lesson, lessonDate, lessonMemo } = req.body;
    
    if (!weekKey || !studentId) {
      res.status(400).json({ error: 'Week key and student ID are required' });
      return;
    }
    
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO weekly_checks (week_key, student_id, dm, dm_date, lesson, lesson_date, lesson_memo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (week_key, student_id) 
      DO UPDATE SET dm = $3, dm_date = $4, lesson = $5, lesson_date = $6, lesson_memo = $7
    `, [weekKey, studentId, dm, dmDate, lesson, lessonDate, lessonMemo || '']);
    
    client.release();
    
    res.json({ weekKey, studentId, dm, dmDate, lesson, lessonDate, lessonMemo: lessonMemo || '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly checks
app.get('/api/monthly/:monthKey', async (req, res) => {
  try {
    const { monthKey } = req.params;
    const client = await pool.connect();
    
    const result = await client.query('SELECT * FROM monthly_checks WHERE month_key = $1', [monthKey]);
    client.release();
    
    const monthlyData = {};
    result.rows.forEach(row => {
      monthlyData[row.student_id] = {
        paid: Boolean(row.paid),
        lastPaid: row.last_paid || '',
        survey: Boolean(row.survey)
      };
    });
    
    res.json(monthlyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update monthly check
app.post('/api/monthly', async (req, res) => {
  try {
    const { monthKey, studentId, paid, lastPaid, survey } = req.body;
    
    if (!monthKey || !studentId) {
      res.status(400).json({ error: 'Month key and student ID are required' });
      return;
    }
    
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO monthly_checks (month_key, student_id, paid, last_paid, survey)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (month_key, student_id) 
      DO UPDATE SET paid = $3, last_paid = $4, survey = $5
    `, [monthKey, studentId, paid, lastPaid, survey]);
    
    client.release();
    
    res.json({ monthKey, studentId, paid, lastPaid, survey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get surveys
app.get('/api/surveys', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM surveys ORDER BY submitted_at DESC');
    client.release();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit survey
app.post('/api/surveys', async (req, res) => {
  try {
    const { memberNumber, studentName, satisfaction, npsScore, instructorFeedback, lessonFeedback, learningGoals, otherFeedback } = req.body;
    
    if (!memberNumber) {
      res.status(400).json({ error: 'Member number is required' });
      return;
    }
    
    const client = await pool.connect();
    
    const result = await client.query(`
      INSERT INTO surveys (member_number, student_name, satisfaction, nps_score, instructor_feedback, lesson_feedback, learning_goals, other_feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [memberNumber, studentName, satisfaction, npsScore, instructorFeedback, lessonFeedback, learningGoals, otherFeedback]);
    
    client.release();
    
    res.json({ id: result.rows[0].id, memberNumber, studentName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 10000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`PostgreSQL server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  // エラーが発生してもサーバーは起動
  app.listen(PORT, () => {
    console.log(`PostgreSQL server running on port ${PORT} (database error)`);
  });
}); 