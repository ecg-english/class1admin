const { Pool } = require('pg');

// 接続情報（環境変数から取得）
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'class1admin',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  console.log('=== PostgreSQL接続テスト開始 ===');
  
  try {
    console.log('接続情報:');
    console.log('  Host:', process.env.DB_HOST || 'localhost');
    console.log('  Database:', process.env.DB_NAME || 'class1admin');
    console.log('  User:', process.env.DB_USER || 'postgres');
    console.log('  Port:', process.env.DB_PORT || 5432);
    console.log('  SSL:', process.env.NODE_ENV === 'production' ? 'Enabled' : 'Disabled');
    
    // 接続テスト
    const client = await pool.connect();
    console.log('✅ PostgreSQL接続成功！');
    
    // 簡単なクエリテスト
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ クエリテスト成功！');
    console.log('  現在時刻:', result.rows[0].current_time);
    console.log('  PostgreSQLバージョン:', result.rows[0].version.split(' ')[0]);
    
    client.release();
    
    // プール終了
    await pool.end();
    console.log('✅ 接続テスト完了');
    
  } catch (error) {
    console.error('❌ PostgreSQL接続エラー:', error.message);
    console.error('詳細:', error);
    
    // 環境変数の確認
    console.log('\n環境変数確認:');
    console.log('  DB_HOST:', process.env.DB_HOST ? '設定済み' : '未設定');
    console.log('  DB_NAME:', process.env.DB_NAME ? '設定済み' : '未設定');
    console.log('  DB_USER:', process.env.DB_USER ? '設定済み' : '未設定');
    console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '設定済み' : '未設定');
    console.log('  DB_PORT:', process.env.DB_PORT ? '設定済み' : '未設定');
    console.log('  NODE_ENV:', process.env.NODE_ENV || '未設定');
  }
}

// スクリプト実行
testConnection(); 