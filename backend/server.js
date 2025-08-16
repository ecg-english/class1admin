const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set NODE_ENV for production
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Initialize database
db.init();

// API Routes
app.use('/api/instructors', require('./routes/instructors'));
app.use('/api/students', require('./routes/students'));
app.use('/api/weekly', require('./routes/weekly'));
app.use('/api/monthly', require('./routes/monthly'));
app.use('/api/surveys', require('./routes/surveys'));
app.use('/api/auth', require('./routes/auth'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Database status endpoint
app.get('/api/db-status', (req, res) => {
  const fs = require('fs');
  const dbPath = '/tmp/class1admin.db';
  const backupPath = '/tmp/class1admin_backup.db';
  
  const status = {
    databaseExists: fs.existsSync(dbPath),
    backupExists: fs.existsSync(backupPath),
    databaseSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    backupSize: fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0,
    timestamp: new Date().toISOString()
  };
  
  res.json(status);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 