const fs = require('fs');
const path = require('path');

// データ永続化システム
class DataPersistence {
  constructor() {
    this.dbPath = '/tmp/class1admin.db';
    this.backupPaths = [
      '/tmp/class1admin_backup.db',
      '/opt/render/project/src/class1admin_backup.db',
      '/app/class1admin_backup.db'
    ];
  }

  // データベースの存在確認と復元
  async ensureDatabase() {
    console.log('Ensuring database persistence...');
    
    const dbExists = fs.existsSync(this.dbPath);
    console.log('Database exists:', dbExists);
    
    if (!dbExists) {
      console.log('Database not found, attempting restore...');
      const restored = await this.restoreFromBackup();
      if (!restored) {
        console.log('No backup found, will create new database');
      }
    } else {
      // データベースが存在する場合、内容をチェック
      const isValid = await this.validateDatabase();
      if (!isValid) {
        console.log('Database is invalid, attempting restore...');
        await this.restoreFromBackup();
      }
    }
  }

  // バックアップから復元
  async restoreFromBackup() {
    for (const backupPath of this.backupPaths) {
      if (fs.existsSync(backupPath)) {
        try {
          if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
          }
          fs.copyFileSync(backupPath, this.dbPath);
          console.log('Database restored from backup:', backupPath);
          return true;
        } catch (error) {
          console.error('Failed to restore from backup:', backupPath, error);
        }
      }
    }
    return false;
  }

  // データベースの妥当性チェック
  async validateDatabase() {
    try {
      const stats = fs.statSync(this.dbPath);
      if (stats.size < 1000) { // 1KB未満は無効
        console.log('Database file too small, likely invalid');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Database validation failed:', error);
      return false;
    }
  }

  // バックアップ作成
  async createBackup() {
    if (!fs.existsSync(this.dbPath)) {
      console.warn('Database file not found for backup');
      return false;
    }

    let successCount = 0;
    for (const backupPath of this.backupPaths) {
      try {
        fs.copyFileSync(this.dbPath, backupPath);
        console.log('Backup created at:', backupPath);
        successCount++;
      } catch (error) {
        console.error('Failed to create backup at:', backupPath, error);
      }
    }
    
    console.log(`Backup completed: ${successCount}/${this.backupPaths.length} locations`);
    return successCount > 0;
  }

  // 定期的なバックアップ
  startPeriodicBackup() {
    if (process.env.NODE_ENV === 'production') {
      // 1分ごとにバックアップ
      setInterval(() => {
        this.createBackup();
      }, 60 * 1000);
      
      // 起動5秒後に初回バックアップ
      setTimeout(() => {
        this.createBackup();
      }, 5000);
    }
  }

  // データベース状態の取得
  getStatus() {
    const status = {
      databaseExists: fs.existsSync(this.dbPath),
      databaseSize: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0,
      backups: this.backupPaths.map(path => ({
        path: path,
        exists: fs.existsSync(path),
        size: fs.existsSync(path) ? fs.statSync(path).size : 0
      })),
      timestamp: new Date().toISOString()
    };
    
    return status;
  }
}

module.exports = DataPersistence; 