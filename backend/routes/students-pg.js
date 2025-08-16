const express = require('express');
const router = express.Router();

// Get all students
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.dbPool;
    const sql = `
      SELECT s.*, i.name as instructor_name 
      FROM students s 
      LEFT JOIN instructors i ON s.instructor_id = i.id 
      ORDER BY s.name
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new student
router.post('/', async (req, res) => {
  try {
    const { name, instructorId, email, note, registrationDate } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    
    const pool = req.app.locals.dbPool;
    const id = 's_' + Math.random().toString(36).slice(2, 10);
    
    // Generate member number
    const memberNumberResult = await pool.query(
      'SELECT member_number FROM students WHERE member_number IS NOT NULL ORDER BY member_number DESC LIMIT 1'
    );
    
    let nextNumber = 'k11';
    if (memberNumberResult.rows.length > 0 && memberNumberResult.rows[0].member_number) {
      const current = memberNumberResult.rows[0].member_number;
      const letter = current.charAt(0);
      const number = parseInt(current.slice(1));
      
      if (number < 99) {
        nextNumber = letter + (number + 1);
      } else {
        const letters = ['k', 'm', 'l', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
        const currentIndex = letters.indexOf(letter);
        if (currentIndex !== -1 && currentIndex < letters.length - 1) {
          nextNumber = letters[currentIndex + 1] + '11';
        } else {
          nextNumber = 'k11';
        }
      }
    }
    
    // Insert student
    const insertResult = await pool.query(
      'INSERT INTO students (id, name, instructor_id, member_number, email, note, registration_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, name, instructorId, nextNumber, email, note, registrationDate]
    );
    
    // Get instructor name
    let instructorName = null;
    if (instructorId) {
      const instructorResult = await pool.query('SELECT name FROM instructors WHERE id = $1', [instructorId]);
      if (instructorResult.rows.length > 0) {
        instructorName = instructorResult.rows[0].name;
      }
    }
    
    const student = insertResult.rows[0];
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
      instructor_name: instructorName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, instructorId, email, note, registrationDate } = req.body;
    
    const pool = req.app.locals.dbPool;
    
    const updateResult = await pool.query(
      'UPDATE students SET name = $1, instructor_id = $2, email = $3, note = $4, registration_date = $5 WHERE id = $6 RETURNING *',
      [name, instructorId, email, note, registrationDate, id]
    );
    
    if (updateResult.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    // Get instructor name
    let instructorName = null;
    if (instructorId) {
      const instructorResult = await pool.query('SELECT name FROM instructors WHERE id = $1', [instructorId]);
      if (instructorResult.rows.length > 0) {
        instructorName = instructorResult.rows[0].name;
      }
    }
    
    const student = updateResult.rows[0];
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
      instructor_name: instructorName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.dbPool;
    
    const result = await pool.query('DELETE FROM students WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 