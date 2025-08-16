const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 超強固なデータ永続化システム v2
class DataPersistenceV2 {
  constructor() {
    this.dbPath = '/tmp/class1admin.db';
    this.backupDir = '/tmp/backups/';
    this.maxBackups = 10;
    
    // バックアップディレクトリを作成
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
        console.log('Backup directory created:', this.backupDir);
      } catch (error) {
        console.error('Failed to create backup directory:', error);
      }
    }
  }

  // データベースの完全復旧
  async ensureDataIntegrity() {
    console.log('=== データ整合性チェック開始 ===');
    
    try {
      // 1. データベースファイルの存在確認
      const dbExists = fs.existsSync(this.dbPath);
      console.log('データベースファイル存在:', dbExists);
      
      if (dbExists) {
        // 2. データベース内容の確認
        const hasData = await this.checkDatabaseContent();
        console.log('データベース内容あり:', hasData);
        
        if (!hasData) {
          console.log('データベースが空です。復元を試行します...');
          await this.restoreFromLatestBackup();
        }
      } else {
        console.log('データベースファイルがありません。復元を試行します...');
        await this.restoreFromLatestBackup();
      }
      
      // 3. 最終確認とフォールバック
      const finalCheck = await this.checkDatabaseContent();
      if (!finalCheck) {
        console.log('復元に失敗しました。初期データを作成します...');
        await this.createInitialDatabase();
      }
      
    } catch (error) {
      console.error('データ整合性チェックでエラー:', error);
      await this.createInitialDatabase();
    }
    
    console.log('=== データ整合性チェック完了 ===');
  }

  // データベース内容の確認
  async checkDatabaseContent() {
    return new Promise((resolve) => {
      try {
        const db = new sqlite3.Database(this.dbPath);
        
        db.get('SELECT COUNT(*) as count FROM instructors', [], (err, row) => {
          if (err) {
            console.log('講師テーブル確認エラー:', err.message);
            db.close();
            resolve(false);
            return;
          }
          
          const instructorCount = row.count;
          console.log('講師数:', instructorCount);
          
          db.get('SELECT COUNT(*) as count FROM students', [], (err, row) => {
            if (err) {
              console.log('生徒テーブル確認エラー:', err.message);
              db.close();
              resolve(false);
              return;
            }
            
            const studentCount = row.count;
            console.log('生徒数:', studentCount);
            
            db.close();
            
            // 講師または生徒のデータがあればOK
            resolve(instructorCount > 0 || studentCount > 0);
          });
        });
        
      } catch (error) {
        console.error('データベース内容確認エラー:', error);
        resolve(false);
      }
    });
  }

  // 最新のバックアップから復元
  async restoreFromLatestBackup() {
    console.log('バックアップからの復元を開始...');
    
    try {
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
        .sort()
        .reverse(); // 最新から順に
      
      console.log('利用可能なバックアップ:', backupFiles);
      
      for (const backupFile of backupFiles) {
        const backupPath = path.join(this.backupDir, backupFile);
        
        try {
          // バックアップファイルの妥当性確認
          const stats = fs.statSync(backupPath);
          if (stats.size < 1000) {
            console.log('バックアップファイルが小さすぎます:', backupPath);
            continue;
          }
          
          // バックアップから復元
          if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
          }
          
          fs.copyFileSync(backupPath, this.dbPath);
          console.log('バックアップから復元しました:', backupPath);
          
          // 復元後の内容確認
          const hasData = await this.checkDatabaseContent();
          if (hasData) {
            console.log('復元成功！データが確認できました');
            return true;
          } else {
            console.log('復元したデータベースが空でした');
          }
          
        } catch (error) {
          console.error('バックアップファイル処理エラー:', backupPath, error);
        }
      }
      
      console.log('すべてのバックアップから復元に失敗しました');
      return false;
      
    } catch (error) {
      console.error('バックアップ復元エラー:', error);
      return false;
    }
  }

  // 初期データベースの作成
  async createInitialDatabase() {
    console.log('初期データベースを作成します...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.serialize(() => {
        // テーブル作成
        db.run(`
          CREATE TABLE IF NOT EXISTS instructors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            instructor_id TEXT,
            member_number TEXT UNIQUE,
            email TEXT,
            note TEXT,
            registration_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (instructor_id) REFERENCES instructors (id)
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS weekly_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            dm BOOLEAN DEFAULT 0,
            dm_date TEXT,
            lesson BOOLEAN DEFAULT 0,
            lesson_date TEXT,
            lesson_memo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students (id),
            UNIQUE(week_key, student_id)
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS monthly_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            paid BOOLEAN DEFAULT 0,
            last_paid TEXT,
            survey BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students (id),
            UNIQUE(month_key, student_id)
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS surveys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_number TEXT NOT NULL,
            student_name TEXT,
            satisfaction INTEGER,
            nps_score INTEGER,
            instructor_feedback TEXT,
            lesson_feedback TEXT,
            learning_goals TEXT,
            other_feedback TEXT,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // 初期データ投入
        console.log('初期データを投入します...');
        
        // 講師データ
        const instructors = [
          { id: 'i_taichi', name: 'Taichi' },
          { id: 'i_takaya', name: 'Takaya' },
          { id: 'i_haruka', name: 'Haruka' }
        ];
        
        instructors.forEach(instructor => {
          db.run('INSERT OR REPLACE INTO instructors (id, name) VALUES (?, ?)', 
            [instructor.id, instructor.name]);
        });
        
        // 生徒データ
        const students = [
          { 
            id: 's_mohamed', 
            name: 'Mohamed Taqi', 
            instructor_id: 'i_taichi',
            member_number: 'k11',
            email: 'mt.taqi@gmail.com',
            note: ''
          },
          { 
            id: 's_test1', 
            name: 'test1', 
            instructor_id: 'i_takaya',
            member_number: 'k12',
            email: 'test1@gmail.com',
            note: '文化を学びたい'
          }
        ];
        
        students.forEach(student => {
          db.run('INSERT OR REPLACE INTO students (id, name, instructor_id, member_number, email, note) VALUES (?, ?, ?, ?, ?, ?)', 
            [student.id, student.name, student.instructor_id, student.member_number, student.email, student.note]);
        });
        
        db.close((err) => {
          if (err) {
            console.error('初期データベース作成エラー:', err);
            reject(err);
          } else {
            console.log('初期データベース作成完了');
            resolve(true);
          }
        });
      });
    });
  }

  // 強化されたバックアップ作成
  async createTimestampedBackup() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        console.log('データベースファイルが存在しません');
        return false;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      fs.copyFileSync(this.dbPath, backupPath);
      console.log('タイムスタンプ付きバックアップ作成:', backupPath);
      
      // 古いバックアップを削除
      await this.cleanOldBackups();
      
      return true;
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
      return false;
    }
  }

  // 古いバックアップファイルの削除
  async cleanOldBackups() {
    try {
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
        .sort();
      
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(0, backupFiles.length - this.maxBackups);
        
        for (const file of filesToDelete) {
          const filePath = path.join(this.backupDir, file);
          fs.unlinkSync(filePath);
          console.log('古いバックアップを削除:', filePath);
        }
      }
    } catch (error) {
      console.error('古いバックアップ削除エラー:', error);
    }
  }

  // 定期的なバックアップ開始
  startPeriodicBackup() {
    if (process.env.NODE_ENV === 'production') {
      // 30秒ごとにバックアップ
      setInterval(() => {
        this.createTimestampedBackup();
      }, 30 * 1000);
      
      // 起動3秒後に初回バックアップ
      setTimeout(() => {
        this.createTimestampedBackup();
      }, 3000);
      
      console.log('定期バックアップを開始しました（30秒間隔）');
    }
  }

  // ステータス取得
  getStatus() {
    try {
      const status = {
        databaseExists: fs.existsSync(this.dbPath),
        databaseSize: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0,
        backupDir: this.backupDir,
        backupDirExists: fs.existsSync(this.backupDir),
        timestamp: new Date().toISOString()
      };
      
      if (fs.existsSync(this.backupDir)) {
        const backupFiles = fs.readdirSync(this.backupDir)
          .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
          .map(file => ({
            name: file,
            path: path.join(this.backupDir, file),
            size: fs.statSync(path.join(this.backupDir, file)).size
          }));
        
        status.backups = backupFiles;
        status.backupCount = backupFiles.length;
      } else {
        status.backups = [];
        status.backupCount = 0;
      }
      
      return status;
    } catch (error) {
      console.error('ステータス取得エラー:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = DataPersistenceV2; 