const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// 緊急データ復旧システム
class EmergencyDataRecovery {
  constructor() {
    this.dbPath = '/tmp/class1admin.db';
    this.emergencyBackupPath = '/tmp/emergency_backup.json';
  }

  // データをJSONファイルに緊急バックアップ
  async createEmergencyBackup() {
    try {
      console.log('=== 緊急JSONバックアップ作成開始 ===');
      
      const db = new sqlite3.Database(this.dbPath);
      const backupData = {
        timestamp: new Date().toISOString(),
        instructors: [],
        students: [],
        weekly_checks: [],
        monthly_checks: [],
        surveys: []
      };

      // 講師データ取得
      const instructors = await this.getTableData(db, 'instructors');
      backupData.instructors = instructors;
      console.log('講師データ取得:', instructors.length, '件');

      // 生徒データ取得
      const students = await this.getTableData(db, 'students');
      backupData.students = students;
      console.log('生徒データ取得:', students.length, '件');

      // 週次チェックデータ取得
      const weeklyChecks = await this.getTableData(db, 'weekly_checks');
      backupData.weekly_checks = weeklyChecks;
      console.log('週次データ取得:', weeklyChecks.length, '件');

      // 月次チェックデータ取得
      const monthlyChecks = await this.getTableData(db, 'monthly_checks');
      backupData.monthly_checks = monthlyChecks;
      console.log('月次データ取得:', monthlyChecks.length, '件');

      // アンケートデータ取得
      const surveys = await this.getTableData(db, 'surveys');
      backupData.surveys = surveys;
      console.log('アンケートデータ取得:', surveys.length, '件');

      db.close();

      // JSONファイルに保存
      fs.writeFileSync(this.emergencyBackupPath, JSON.stringify(backupData, null, 2));
      console.log('緊急バックアップ作成完了:', this.emergencyBackupPath);

      return backupData;
    } catch (error) {
      console.error('緊急バックアップ作成エラー:', error);
      throw error;
    }
  }

  // JSONバックアップから復元
  async restoreFromEmergencyBackup() {
    try {
      console.log('=== 緊急復元開始 ===');

      if (!fs.existsSync(this.emergencyBackupPath)) {
        console.log('緊急バックアップファイルが見つかりません');
        return false;
      }

      const backupData = JSON.parse(fs.readFileSync(this.emergencyBackupPath, 'utf8'));
      console.log('緊急バックアップデータ読み込み完了:', backupData.timestamp);

      // データベースを初期化
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }

      const db = new sqlite3.Database(this.dbPath);
      
      // テーブル作成
      await this.createTables(db);
      
      // データ復元
      await this.restoreTableData(db, 'instructors', backupData.instructors);
      await this.restoreTableData(db, 'students', backupData.students);
      await this.restoreTableData(db, 'weekly_checks', backupData.weekly_checks);
      await this.restoreTableData(db, 'monthly_checks', backupData.monthly_checks);
      await this.restoreTableData(db, 'surveys', backupData.surveys);

      db.close();
      console.log('緊急復元完了');
      return true;
    } catch (error) {
      console.error('緊急復元エラー:', error);
      return false;
    }
  }

  // テーブルデータ取得
  getTableData(db, tableName) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // テーブル作成
  createTables(db) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE instructors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE students (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          instructor_id TEXT,
          member_number TEXT UNIQUE,
          email TEXT,
          note TEXT,
          registration_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE weekly_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_key TEXT NOT NULL,
          student_id TEXT NOT NULL,
          dm BOOLEAN DEFAULT 0,
          dm_date TEXT,
          lesson BOOLEAN DEFAULT 0,
          lesson_date TEXT,
          lesson_memo TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(week_key, student_id)
        )`);
        
        db.run(`CREATE TABLE monthly_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month_key TEXT NOT NULL,
          student_id TEXT NOT NULL,
          paid BOOLEAN DEFAULT 0,
          last_paid TEXT,
          survey BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(month_key, student_id)
        )`);
        
        db.run(`CREATE TABLE surveys (
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
        )`, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  // テーブルデータ復元
  restoreTableData(db, tableName, data) {
    return new Promise((resolve, reject) => {
      if (!data || data.length === 0) {
        console.log(`${tableName}: データなし`);
        resolve();
        return;
      }

      console.log(`${tableName}: ${data.length}件のデータを復元中...`);
      
      let completed = 0;
      let hasError = false;

      data.forEach((row, index) => {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        db.run(sql, values, (err) => {
          if (err && !hasError) {
            hasError = true;
            console.error(`${tableName} 復元エラー:`, err);
            reject(err);
          } else {
            completed++;
            if (completed === data.length) {
              console.log(`${tableName}: ${completed}件の復元完了`);
              resolve();
            }
          }
        });
      });
    });
  }
}

module.exports = EmergencyDataRecovery; 