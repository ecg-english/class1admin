const express = require('express');
const router = express.Router();
const db = require('../database');

// Get weekly checks for a specific week
router.get('/:weekKey', (req, res) => {
  const { weekKey } = req.params;
  
  const sql = `
    SELECT wc.*, s.name as student_name, s.instructor_id, i.name as instructor_name
    FROM weekly_checks wc
    JOIN students s ON wc.student_id = s.id
    LEFT JOIN instructors i ON s.instructor_id = i.id
    WHERE wc.week_key = ?
  `;
  
  db.getDb().all(sql, [weekKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Convert to the format expected by frontend
    const result = {};
    rows.forEach(row => {
      result[row.student_id] = {
        dm: Boolean(row.dm),
        dmDate: row.dm_date || '',
        lesson: Boolean(row.lesson),
        lessonDate: row.lesson_date || ''
      };
    });
    
    res.json(result);
  });
});

// Update weekly check
router.post('/:weekKey/:studentId', (req, res) => {
  const { weekKey, studentId } = req.params;
  const { dm, dmDate, lesson, lessonDate } = req.body;
  
  const sql = `
    INSERT OR REPLACE INTO weekly_checks (week_key, student_id, dm, dm_date, lesson, lesson_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.getDb().run(sql, [weekKey, studentId, dm ? 1 : 0, dmDate, lesson ? 1 : 0, lessonDate], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ weekKey, studentId, dm, dmDate, lesson, lessonDate });
  });
});

// Get calendar data (for calendar view)
router.get('/calendar/:monthKey', (req, res) => {
  const { monthKey } = req.params;
  
  const sql = `
    SELECT wc.*, s.name as student_name, s.instructor_id, i.name as instructor_name
    FROM weekly_checks wc
    JOIN students s ON wc.student_id = s.id
    LEFT JOIN instructors i ON s.instructor_id = i.id
    WHERE wc.week_key LIKE ? || '%'
  `;
  
  db.getDb().all(sql, [monthKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Group by week
    const result = {};
    rows.forEach(row => {
      if (!result[row.week_key]) {
        result[row.week_key] = {};
      }
      result[row.week_key][row.student_id] = {
        dm: Boolean(row.dm),
        dmDate: row.dm_date || '',
        lesson: Boolean(row.lesson),
        lessonDate: row.lesson_date || '',
        studentName: row.student_name,
        instructorName: row.instructor_name
      };
    });
    
    res.json(result);
  });
});

module.exports = router; 