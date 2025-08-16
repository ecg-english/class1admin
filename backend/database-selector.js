const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DataPersistenceV3 = require('./data-persistence-v3');
const { initPostgres, getPool } = require('./postgres-database');

// データベース選択システム
class DatabaseSelector {
  constructor() {
    this.dbType = null;
    this.sqliteDb = null;
    this.postgresPool = null;
    this.dataPersistence = null;
  }

  // データベースタイプを決定
  async determineDatabaseType() {
    console.log('=== データベースタイプ決定開始 ===');
    
    // PostgreSQL接続情報の確認
    const hasPostgresConfig = this.checkPostgresConfig();
    
    if (hasPostgresConfig) {
      console.log('PostgreSQL接続情報が利用可能です');
      
      try {
        // PostgreSQL接続テスト
        const pool = getPool();
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        console.log('PostgreSQL接続成功 - PostgreSQLを使用します');
        this.dbType = 'postgres';
        this.postgresPool = pool;
        return 'postgres';
      } catch (error) {
        console.log('PostgreSQL接続失敗:', error.message);
        console.log('SQLiteにフォールバックします');
      }
    }
    
    // SQLiteフォールバック
    console.log('SQLiteを使用します');
    this.dbType = 'sqlite';
    this.dataPersistence = new DataPersistenceV3();
    return 'sqlite';
  }

  // PostgreSQL接続情報の確認
  checkPostgresConfig() {
    const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
    const hasAllVars = requiredVars.every(varName => process.env[varName]);
    
    console.log('PostgreSQL環境変数確認:');
    requiredVars.forEach(varName => {
      const hasVar = !!process.env[varName];
      console.log(`  ${varName}: ${hasVar ? '✓' : '✗'}`);
    });
    
    return hasAllVars;
  }

  // データベース初期化
  async init() {
    const dbType = await this.determineDatabaseType();
    
    if (dbType === 'postgres') {
      await initPostgres();
    } else {
      await this.dataPersistence.ensureDataIntegrity();
    }
  }

  // データベース接続取得
  getDb() {
    if (this.dbType === 'postgres') {
      return this.postgresPool;
    } else {
      return this.dataPersistence ? this.dataPersistence.getDb() : null;
    }
  }

  // データベースタイプ取得
  getDbType() {
    return this.dbType;
  }

  // ステータス取得
  async getStatus() {
    if (this.dbType === 'postgres') {
      try {
        const client = await this.postgresPool.connect();
        const result = await client.query('SELECT COUNT(*) as count FROM students');
        client.release();
        
        return {
          type: 'postgres',
          connected: true,
          studentCount: parseInt(result.rows[0].count),
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          type: 'postgres',
          connected: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    } else {
      return this.dataPersistence ? this.dataPersistence.getStatus() : {
        type: 'sqlite',
        connected: false,
        error: 'Data persistence not initialized',
        timestamp: new Date().toISOString()
      };
    }
  }

  // データベース終了
  async close() {
    if (this.dbType === 'postgres' && this.postgresPool) {
      await this.postgresPool.end();
    } else if (this.sqliteDb) {
      this.sqliteDb.close();
    }
  }
}

module.exports = DatabaseSelector; 