const { Pool } = require('pg');

// PostgreSQL接続設定
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'class1admin',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 接続テスト
pool.on('connect', () => {
  console.log('PostgreSQLデータベースに接続しました');
});

pool.on('error', (err) => {
  console.error('PostgreSQL接続エラー:', err);
});

module.exports = pool; 