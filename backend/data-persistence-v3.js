const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Render無料プラン対応 超強固データ永続化システム v3
class DataPersistenceV3 {
  constructor() {
    // より永続的なディレクトリを優先的に使用
    this.possibleDbPaths = [
      '/opt/render/project/src/data/class1admin.db',
      '/app/data/class1admin.db', 
      '/home/render/data/class1admin.db',
      '/var/tmp/class1admin.db',
      '/tmp/class1admin.db'
    ];
    
    this.possibleBackupDirs = [
      '/opt/render/project/src/backups/',
      '/app/backups/',
      '/home/render/backups/',
      '/var/tmp/backups/',
      '/tmp/backups/'
    ];
    
    this.dbPath = this.findBestDbPath();
    this.backupDir = this.findBestBackupDir();
    this.maxBackups = 20; // バックアップ数を増加
    
    console.log('=== DataPersistenceV3 初期化 ===');
    console.log('選択されたDBパス:', this.dbPath);
    console.log('選択されたバックアップディレクトリ:', this.backupDir);
    
    // ディレクトリ作成
    this.ensureDirectories();
  }

  // 最適なDBパスを選択
  findBestDbPath() {
    for (const dbPath of this.possibleDbPaths) {
      const dir = path.dirname(dbPath);
      if (this.isDirectoryWritable(dir)) {
        console.log('書き込み可能なDBパスを発見:', dbPath);
        return dbPath;
      }
    }
    // フォールバック
    console.log('フォールバック: /tmp/class1admin.db');
    return '/tmp/class1admin.db';
  }

  // 最適なバックアップディレクトリを選択
  findBestBackupDir() {
    for (const backupDir of this.possibleBackupDirs) {
      if (this.isDirectoryWritable(backupDir)) {
        console.log('書き込み可能なバックアップディレクトリを発見:', backupDir);
        return backupDir;
      }
    }
    // フォールバック
    console.log('フォールバック: /tmp/backups/');
    return '/tmp/backups/';
  }

  // ディレクトリの書き込み権限チェック
  isDirectoryWritable(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      const testFile = path.join(dirPath, 'test_write.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch (error) {
      console.log('ディレクトリ書き込みテスト失敗:', dirPath, error.message);
      return false;
    }
  }

  // ディレクトリ作成
  ensureDirectories() {
    try {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('DBディレクトリ作成:', dbDir);
      }
      
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
        console.log('バックアップディレクトリ作成:', this.backupDir);
      }
    } catch (error) {
      console.error('ディレクトリ作成エラー:', error);
    }
  }

  // データベースの完全復旧（強化版）
  async ensureDataIntegrity() {
    console.log('=== データ整合性チェック開始 (v3) ===');
    
    try {
      // 1. 既存データベースの検索
      const existingDbPath = await this.findExistingDatabase();
      if (existingDbPath && existingDbPath !== this.dbPath) {
        console.log('既存データベースを発見:', existingDbPath);
        await this.migrateDatabase(existingDbPath, this.dbPath);
      }

      // 2. データベースファイルの存在確認
      const dbExists = fs.existsSync(this.dbPath);
      console.log('データベースファイル存在:', dbExists);
      
      if (dbExists) {
        // 3. データベース内容の確認
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
      
      // 4. 最終確認とフォールバック
      const finalCheck = await this.checkDatabaseContent();
      if (!finalCheck) {
        console.log('復元に失敗しました。初期データベースを作成します...');
        await this.createInitialDatabase();
      } else {
        console.log('データベースにデータが存在します。初期化をスキップします。');
      }
      
    } catch (error) {
      console.error('データ整合性チェックでエラー:', error);
      await this.createInitialDatabase();
    }
    
    console.log('=== データ整合性チェック完了 (v3) ===');
  }

  // 既存データベースの検索
  async findExistingDatabase() {
    for (const dbPath of this.possibleDbPaths) {
      if (fs.existsSync(dbPath)) {
        try {
          const stats = fs.statSync(dbPath);
          if (stats.size > 1000) { // 1KB以上
            const hasData = await this.checkDatabaseContentAtPath(dbPath);
            if (hasData) {
              return dbPath;
            }
          }
        } catch (error) {
          console.log('データベースチェックエラー:', dbPath, error.message);
        }
      }
    }
    return null;
  }

  // 指定パスのデータベース内容確認
  async checkDatabaseContentAtPath(dbPath) {
    return new Promise((resolve) => {
      try {
        const db = new sqlite3.Database(dbPath);
        db.get('SELECT COUNT(*) as count FROM instructors', [], (err, row) => {
          if (err) {
            db.close();
            resolve(false);
            return;
          }
          const instructorCount = row.count;
          db.get('SELECT COUNT(*) as count FROM students', [], (err, row) => {
            db.close();
            if (err) {
              resolve(false);
            } else {
              const studentCount = row.count;
              resolve(instructorCount > 0 || studentCount > 0);
            }
          });
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  // データベース移行
  async migrateDatabase(sourcePath, targetPath) {
    try {
      console.log('データベース移行開始:', sourcePath, '->', targetPath);
      
      // ターゲットディレクトリ作成
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // ファイルコピー
      fs.copyFileSync(sourcePath, targetPath);
      console.log('データベース移行完了');
      
      // バックアップ作成
      await this.createTimestampedBackup();
      
    } catch (error) {
      console.error('データベース移行エラー:', error);
    }
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

  // 最新のバックアップから復元（強化版）
  async restoreFromLatestBackup() {
    console.log('バックアップからの復元を開始...');
    
    try {
      // 全バックアップディレクトリから検索
      const allBackupFiles = [];
      
      for (const backupDir of this.possibleBackupDirs) {
        if (fs.existsSync(backupDir)) {
          try {
            const files = fs.readdirSync(backupDir)
              .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
              .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                dir: backupDir
              }));
            allBackupFiles.push(...files);
          } catch (error) {
            console.log('バックアップディレクトリ読み込みエラー:', backupDir, error.message);
          }
        }
      }
      
      // 最新のバックアップを選択
      allBackupFiles.sort((a, b) => {
        const timeA = new Date(a.name.replace('backup_', '').replace('.db', ''));
        const timeB = new Date(b.name.replace('backup_', '').replace('.db', ''));
        return timeB - timeA;
      });
      
      console.log('利用可能なバックアップ:', allBackupFiles.length, '件');
      
      for (const backupFile of allBackupFiles) {
        try {
          // バックアップファイルの妥当性確認
          const stats = fs.statSync(backupFile.path);
          if (stats.size < 1000) {
            console.log('バックアップファイルが小さすぎます:', backupFile.path);
            continue;
          }
          
          // バックアップから復元
          if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
          }
          
          fs.copyFileSync(backupFile.path, this.dbPath);
          console.log('バックアップから復元しました:', backupFile.path);
          
          // 復元後の内容確認
          const hasData = await this.checkDatabaseContent();
          if (hasData) {
            console.log('復元成功！データが確認できました');
            return true;
          } else {
            console.log('復元したデータベースが空でした');
          }
          
        } catch (error) {
          console.error('バックアップファイル処理エラー:', backupFile.path, error);
        }
      }
      
      console.log('すべてのバックアップから復元に失敗しました');
      return false;
      
    } catch (error) {
      console.error('バックアップ復元エラー:', error);
      return false;
    }
  }

  // 初期データベースの作成（強化版）
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
        
        // 初期データ投入（テーブルが空の場合のみ）
        console.log('初期データを投入します...');
        
        // 再度確認：本当にテーブルが空か？
        db.get('SELECT COUNT(*) as count FROM instructors', [], (err, row) => {
          if (!err && row.count === 0) {
            console.log('講師テーブルが空です。初期データを投入します。');
            
            // 講師データ
            const instructors = [
              { id: 'i_taichi', name: 'Taichi' },
              { id: 'i_takaya', name: 'Takaya' },
              { id: 'i_haruka', name: 'Haruka' }
            ];
            
            instructors.forEach(instructor => {
              db.run('INSERT INTO instructors (id, name) VALUES (?, ?)', 
                [instructor.id, instructor.name], (err) => {
                if (err) {
                  console.error('講師データ投入エラー:', err);
                } else {
                  console.log('講師データ投入成功:', instructor.name);
                }
              });
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
              db.run('INSERT INTO students (id, name, instructor_id, member_number, email, note) VALUES (?, ?, ?, ?, ?, ?)', 
                [student.id, student.name, student.instructor_id, student.member_number, student.email, student.note], (err) => {
                if (err) {
                  console.error('生徒データ投入エラー:', err);
                } else {
                  console.log('生徒データ投入成功:', student.name);
                }
              });
            });
          } else {
            console.log('講師テーブルにデータが存在します。初期データ投入をスキップします。');
          }
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

  // 定期的なバックアップ開始（強化版）
  startPeriodicBackup() {
    if (process.env.NODE_ENV === 'production') {
      // 15秒ごとにバックアップ（より頻繁に）
      setInterval(() => {
        this.createTimestampedBackup();
      }, 15 * 1000);
      
      // 起動5秒後に初回バックアップ
      setTimeout(() => {
        this.createTimestampedBackup();
      }, 5000);
      
      console.log('定期バックアップを開始しました（15秒間隔）');
    }
  }

  // ステータス取得（強化版）
  getStatus() {
    try {
      const status = {
        databaseExists: fs.existsSync(this.dbPath),
        databaseSize: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0,
        dbPath: this.dbPath,
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

module.exports = DataPersistenceV3; 