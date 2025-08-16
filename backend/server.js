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
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = '/tmp/class1admin.db';
  const backupPaths = [
    '/tmp/class1admin_backup.db',
    '/opt/render/project/src/class1admin_backup.db',
    '/app/class1admin_backup.db'
  ];
  
  const status = {
    databaseExists: fs.existsSync(dbPath),
    databaseSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    backups: backupPaths.map(path => ({
      path: path,
      exists: fs.existsSync(path),
      size: fs.existsSync(path) ? fs.statSync(path).size : 0
    })),
    timestamp: new Date().toISOString()
  };
  
  // データベースの内容もチェック
  if (fs.existsSync(dbPath)) {
    try {
      const tempDb = new sqlite3.Database(dbPath);
      tempDb.get('SELECT COUNT(*) as studentCount FROM students', [], (err, studentRow) => {
        if (!err) {
          status.studentCount = studentRow.studentCount;
        }
        tempDb.get('SELECT COUNT(*) as instructorCount FROM instructors', [], (err, instructorRow) => {
          if (!err) {
            status.instructorCount = instructorRow.instructorCount;
          }
          tempDb.close();
          res.json(status);
        });
      });
    } catch (error) {
      status.error = error.message;
      res.json(status);
    }
  } else {
    res.json(status);
  }
});

// Manual database restore endpoint
app.post('/api/db-restore', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    res.status(403).json({ error: 'Restore only available in production' });
    return;
  }
  
  const fs = require('fs');
  const backupPaths = [
    '/tmp/class1admin_backup.db',
    '/opt/render/project/src/class1admin_backup.db',
    '/app/class1admin_backup.db'
  ];
  
  let restored = false;
  let restorePath = '';
  
  for (const backupPath of backupPaths) {
    if (fs.existsSync(backupPath)) {
      try {
        const dbPath = '/tmp/class1admin.db';
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }
        fs.copyFileSync(backupPath, dbPath);
        restored = true;
        restorePath = backupPath;
        break;
      } catch (error) {
        console.error('Failed to restore from backup:', backupPath, error);
      }
    }
  }
  
  if (restored) {
    res.json({ 
      success: true, 
      message: 'Database restored successfully',
      backupPath: restorePath
    });
  } else {
    res.status(500).json({ 
      error: 'No backup found or restore failed' 
    });
  }
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