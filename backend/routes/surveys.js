const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all surveys
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM surveys ORDER BY submitted_at DESC';
  db.getDb().all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get surveys by month
router.get('/month/:monthKey', (req, res) => {
  const { monthKey } = req.params;
  
  const sql = `
    SELECT * FROM surveys 
    WHERE strftime('%Y-%m', submitted_at) = ?
    ORDER BY submitted_at DESC
  `;
  
  db.getDb().all(sql, [monthKey], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Submit new survey
router.post('/', (req, res) => {
  const {
    memberNumber,
    studentName,
    satisfaction,
    npsScore,
    instructorFeedback,
    lessonFeedback,
    learningGoals,
    otherFeedback
  } = req.body;
  
  if (!memberNumber) {
    res.status(400).json({ error: 'Member number is required' });
    return;
  }
  
  const sql = `
    INSERT INTO surveys (
      member_number, student_name, satisfaction, nps_score,
      instructor_feedback, lesson_feedback, learning_goals, other_feedback
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const learningGoalsStr = Array.isArray(learningGoals) ? learningGoals.join(',') : learningGoals;
  
  db.getDb().run(sql, [
    memberNumber,
    studentName,
    satisfaction,
    npsScore,
    instructorFeedback,
    lessonFeedback,
    learningGoalsStr,
    otherFeedback
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Update student survey status
    updateStudentSurveyStatus(memberNumber);
    
    res.json({
      id: this.lastID,
      memberNumber,
      studentName,
      satisfaction,
      npsScore,
      instructorFeedback,
      lessonFeedback,
      learningGoals,
      otherFeedback,
      submittedAt: new Date().toISOString()
    });
  });
});

// Search surveys
router.get('/search/:query', (req, res) => {
  const { query } = req.params;
  
  const sql = `
    SELECT * FROM surveys 
    WHERE member_number LIKE ? OR student_name LIKE ?
    ORDER BY submitted_at DESC
  `;
  
  const searchTerm = `%${query}%`;
  db.getDb().all(sql, [searchTerm, searchTerm], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get available months
router.get('/months', (req, res) => {
  const sql = `
    SELECT DISTINCT strftime('%Y-%m', submitted_at) as month_key
    FROM surveys 
    ORDER BY month_key DESC
  `;
  
  db.getDb().all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const months = rows.map(row => row.month_key);
    res.json(months);
  });
});

function updateStudentSurveyStatus(memberNumber) {
  // Get current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Find student by member number
  const findStudentSql = 'SELECT id FROM students WHERE member_number = ?';
  db.getDb().get(findStudentSql, [memberNumber], (err, student) => {
    if (err || !student) {
      console.error('Error finding student:', err);
      return;
    }
    
    // Update survey status
    const updateSql = `
      INSERT OR REPLACE INTO monthly_checks (month_key, student_id, paid, last_paid, survey)
      VALUES (?, ?, 0, '', 1)
    `;
    
    db.getDb().run(updateSql, [currentMonth, student.id], (err) => {
      if (err) {
        console.error('Error updating survey status:', err);
      }
    });
  });
}

module.exports = router; 