const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all students
router.get('/', (req, res) => {
  const sql = `
    SELECT s.*, i.name as instructor_name 
    FROM students s 
    LEFT JOIN instructors i ON s.instructor_id = i.id 
    ORDER BY s.name
  `;
  db.getDb().all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add new student
router.post('/', (req, res) => {
  const { name, instructorId, email, note, registrationDate } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  
  const id = 's_' + Math.random().toString(36).slice(2, 10);
  
  // Generate member number
  const getNextMemberNumber = () => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT member_number FROM students WHERE member_number IS NOT NULL ORDER BY member_number DESC LIMIT 1';
      db.getDb().get(sql, [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        let nextNumber = 'k11';
        if (row && row.member_number) {
          const current = row.member_number;
          const letter = current.charAt(0);
          const number = parseInt(current.slice(1));
          
          if (number < 99) {
            nextNumber = letter + (number + 1);
          } else if (letter < 'z') {
            nextNumber = String.fromCharCode(letter.charCodeAt(0) + 1) + '11';
          } else {
            nextNumber = 'k11';
          }
        }
        resolve(nextNumber);
      });
    });
  };
  
  getNextMemberNumber().then(memberNumber => {
    const sql = 'INSERT INTO students (id, name, instructor_id, member_number, email, note, registration_date) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.getDb().run(sql, [id, name, instructorId, memberNumber, email, note, registrationDate], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, instructorId, memberNumber, email, note, registrationDate });
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Update student
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, instructorId, email, note, registrationDate } = req.body;
  
  // First check if student exists
  const checkSql = 'SELECT * FROM students WHERE id = ?';
  db.getDb().get(checkSql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    // Use existing values if not provided in the update
    const updateName = name !== undefined && name !== null ? name : row.name;
    const updateInstructorId = instructorId !== undefined ? instructorId : row.instructor_id;
    const updateEmail = email !== undefined ? email : row.email;
    const updateNote = note !== undefined ? note : row.note;
    const updateRegistrationDate = registrationDate !== undefined ? registrationDate : row.registration_date;
    
    // Update student (preserve existing member_number)
    const sql = 'UPDATE students SET name = ?, instructor_id = ?, email = ?, note = ?, registration_date = ? WHERE id = ?';
    db.getDb().run(sql, [updateName, updateInstructorId, updateEmail, updateNote, updateRegistrationDate, id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Return updated student data
      res.json({ 
        id, 
        name: updateName, 
        instructorId: updateInstructorId, 
        memberNumber: row.member_number, 
        email: updateEmail, 
        note: updateNote, 
        registrationDate: updateRegistrationDate 
      });
    });
  });
});

// Delete student
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // Delete related data first
  const deleteChecksSql = 'DELETE FROM weekly_checks WHERE student_id = ?';
  db.getDb().run(deleteChecksSql, [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const deleteMonthlySql = 'DELETE FROM monthly_checks WHERE student_id = ?';
    db.getDb().run(deleteMonthlySql, [id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Delete student
      const deleteStudentSql = 'DELETE FROM students WHERE id = ?';
      db.getDb().run(deleteStudentSql, [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Student deleted successfully' });
      });
    });
  });
});

// Get next member number
router.get('/next-member-number', (req, res) => {
  const sql = 'SELECT member_number FROM students WHERE member_number IS NOT NULL ORDER BY member_number DESC LIMIT 1';
  db.getDb().get(sql, [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    let nextNumber = 'k11';
    if (row && row.member_number) {
      const current = row.member_number;
      const letter = current.charAt(0);
      const number = parseInt(current.slice(1));
      
      if (number < 99) {
        nextNumber = letter + (number + 1);
      } else {
        const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
        nextNumber = nextLetter + '11';
      }
    }
    
    res.json({ nextMemberNumber: nextNumber });
  });
});

module.exports = router; 