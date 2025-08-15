const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  
  const sql = 'SELECT * FROM users WHERE username = ?';
  db.getDb().get(sql, [username], async (err, user) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  });
});

// Register (for initial setup)
router.post('/register', async (req, res) => {
  const { username, password, role = 'instructor' } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const sql = 'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)';
    db.getDb().run(sql, [username, hashedPassword, role], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Username already exists' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      
      res.json({
        id: this.lastID,
        username,
        role
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error hashing password' });
  }
});

// Verify token middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Protected route example
router.get('/profile', verifyToken, (req, res) => {
  res.json({
    userId: req.user.userId,
    username: req.user.username,
    role: req.user.role
  });
});

module.exports = router; 