const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all instructors
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM instructors ORDER BY name';
  db.getDb().all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add new instructor
router.post('/', (req, res) => {
  const { id, name } = req.body;
  
  if (!id || !name) {
    res.status(400).json({ error: 'ID and name are required' });
    return;
  }
  
  const sql = 'INSERT INTO instructors (id, name) VALUES (?, ?)';
  db.getDb().run(sql, [id, name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id, name });
  });
});

// Delete instructor
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // First, clear instructor_id for students
  const updateSql = 'UPDATE students SET instructor_id = NULL WHERE instructor_id = ?';
  db.getDb().run(updateSql, [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Then delete instructor
    const deleteSql = 'DELETE FROM instructors WHERE id = ?';
    db.getDb().run(deleteSql, [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Instructor deleted successfully' });
    });
  });
});

module.exports = router; 