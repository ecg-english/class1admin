const { initPostgres } = require('./postgres-database');

async function initializeDatabase() {
  console.log('=== PostgreSQLデータベース初期化スクリプト ===');
  
  try {
    await initPostgres();
    console.log('✅ データベース初期化完了！');
    console.log('✅ テーブル作成完了！');
    console.log('✅ 初期データ投入完了！');
    
    console.log('\n初期データ:');
    console.log('  講師: Taichi, Takaya, Haruka');
    console.log('  生徒: Mohamed Taqi (k11), test1 (k12)');
    
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error.message);
    console.error('詳細:', error);
  }
}

// スクリプト実行
initializeDatabase(); 