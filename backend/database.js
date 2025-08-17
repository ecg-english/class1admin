const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DataPersistenceV2 = require('./data-persistence-v2');

let db;
let dataPersistence;

async function init() {
  console.log('=== データベース初期化開始 ===');
  
  // 強化されたデータ永続化システムの初期化
  dataPersistence = new DataPersistenceV2();
  
  if (process.env.NODE_ENV === 'production') {
    // 本番環境では完全なデータ整合性チェック
    await dataPersistence.ensureDataIntegrity();
    
    // 定期的なバックアップを開始
    dataPersistence.startPeriodicBackup();
  }
  
  // データベースパスの設定
  let dbPath;
  if (process.env.NODE_ENV === 'production') {
    dbPath = '/tmp/class1admin.db';
  } else {
    dbPath = path.join(__dirname, 'class1admin.db');
  }
  
  console.log('データベースパス:', dbPath);
  db = new sqlite3.Database(dbPath);
  
  console.log('=== データベース初期化完了 ===');
  
  // 新しいデータ永続化システムが初期化を担当
  console.log('新しいデータ永続化システムがすべて処理しました');
}

// insertInitialData関数は新しいシステムに統合されました

function getDb() {
  return db;
}

function close() {
  if (db) {
    db.close();
  }
}

// 新しいデータ永続化システムを使用
function backupDatabase() {
  if (dataPersistence) {
    dataPersistence.createTimestampedBackup();
  }
}

// ステータス取得（新システム対応）
async function getStatus() {
  if (dataPersistence) {
    return dataPersistence.getStatus();
  } else {
    return {
      error: 'Data persistence system not initialized',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  init,
  getDb,
  close,
  backupDatabase,
  getStatus
}; 