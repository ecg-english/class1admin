const express = require('express');
const router = express.Router();
const db = require('../database');

// Get monthly checks for a specific month
router.get('/:monthKey', (req, res) => {
  const { monthKey } = req.params;
  
  const sql = `
    SELECT mc.*, s.name as student_name, s.instructor_id, i.name as instructor_name
    FROM monthly_checks mc
    JOIN students s ON mc.student_id = s.id
    LEFT JOIN instructors i ON s.instructor_id = i.id
    WHERE mc.month_key = ?
  `;
  
  db.getDb().all(sql, [monthKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Convert to the format expected by frontend
    const result = {};
    rows.forEach(row => {
      result[row.student_id] = {
        paid: Boolean(row.paid),
        lastPaid: row.last_paid || '',
        survey: Boolean(row.survey)
      };
    });
    
    res.json(result);
  });
});

// Update monthly check
router.post('/:monthKey/:studentId', (req, res) => {
  const { monthKey, studentId } = req.params;
  const { paid, lastPaid, survey } = req.body;
  
  const sql = `
    INSERT OR REPLACE INTO monthly_checks (month_key, student_id, paid, last_paid, survey)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.getDb().run(sql, [monthKey, studentId, paid ? 1 : 0, lastPaid, survey ? 1 : 0], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ monthKey, studentId, paid, lastPaid, survey });
  });
});

// Get all monthly data for manager dashboard
router.get('/manager/:monthKey', (req, res) => {
  const { monthKey } = req.params;
  
  const sql = `
    SELECT 
      s.id, s.name, s.member_number, s.email, s.note,
      i.name as instructor_name,
      mc.paid, mc.last_paid, mc.survey
    FROM students s
    LEFT JOIN instructors i ON s.instructor_id = i.id
    LEFT JOIN monthly_checks mc ON s.id = mc.student_id AND mc.month_key = ?
    ORDER BY s.name
  `;
  
  db.getDb().all(sql, [monthKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Format the response
    const result = rows.map(row => ({
      id: row.id,
      name: row.name,
      memberNumber: row.member_number,
      email: row.email,
      note: row.note,
      instructorId: row.instructor_id,
      instructorName: row.instructor_name,
      paid: Boolean(row.paid),
      lastPaid: row.last_paid || '',
      survey: Boolean(row.survey)
    }));
    
    res.json(result);
  });
});

module.exports = router; 