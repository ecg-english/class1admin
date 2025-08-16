const pool = require('./postgres-config');

// PostgreSQLデータベース初期化
async function initPostgres() {
  console.log('=== PostgreSQLデータベース初期化開始 ===');
  
  try {
    // テーブル作成
    await createTables();
    
    // 初期データ投入
    await insertInitialData();
    
    console.log('=== PostgreSQLデータベース初期化完了 ===');
  } catch (error) {
    console.error('PostgreSQL初期化エラー:', error);
    throw error;
  }
}

// テーブル作成
async function createTables() {
  console.log('PostgreSQLテーブルを作成中...');
  
  const client = await pool.connect();
  
  try {
    // Instructors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS instructors (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Students table
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        instructor_id VARCHAR(50),
        member_number VARCHAR(20) UNIQUE,
        email VARCHAR(100),
        note TEXT,
        registration_date VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instructor_id) REFERENCES instructors (id)
      )
    `);
    
    // Weekly checks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_checks (
        id SERIAL PRIMARY KEY,
        week_key VARCHAR(20) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        dm BOOLEAN DEFAULT FALSE,
        dm_date VARCHAR(20),
        lesson BOOLEAN DEFAULT FALSE,
        lesson_date VARCHAR(20),
        lesson_memo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students (id),
        UNIQUE(week_key, student_id)
      )
    `);
    
    // Monthly checks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_checks (
        id SERIAL PRIMARY KEY,
        month_key VARCHAR(20) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        paid BOOLEAN DEFAULT FALSE,
        last_paid VARCHAR(20),
        survey BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students (id),
        UNIQUE(month_key, student_id)
      )
    `);
    
    // Surveys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        member_number VARCHAR(20) NOT NULL,
        student_name VARCHAR(100),
        satisfaction INTEGER,
        nps_score INTEGER,
        instructor_feedback TEXT,
        lesson_feedback TEXT,
        learning_goals TEXT,
        other_feedback TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'instructor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('PostgreSQLテーブル作成完了');
  } finally {
    client.release();
  }
}

// 初期データ投入
async function insertInitialData() {
  console.log('初期データを投入中...');
  
  const client = await pool.connect();
  
  try {
    // 講師データの存在確認
    const instructorResult = await client.query('SELECT COUNT(*) FROM instructors');
    const instructorCount = parseInt(instructorResult.rows[0].count);
    
    if (instructorCount === 0) {
      console.log('講師データが存在しません。初期データを投入します。');
      
      // 講師データ投入
      const instructors = [
        { id: 'i_taichi', name: 'Taichi' },
        { id: 'i_takaya', name: 'Takaya' },
        { id: 'i_haruka', name: 'Haruka' }
      ];
      
      for (const instructor of instructors) {
        await client.query(
          'INSERT INTO instructors (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
          [instructor.id, instructor.name]
        );
        console.log('講師データ投入成功:', instructor.name);
      }
      
      // 生徒データ投入
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
      
      for (const student of students) {
        await client.query(
          'INSERT INTO students (id, name, instructor_id, member_number, email, note) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [student.id, student.name, student.instructor_id, student.member_number, student.email, student.note]
        );
        console.log('生徒データ投入成功:', student.name);
      }
    } else {
      console.log('講師データが既に存在します。初期データ投入をスキップします。');
    }
  } finally {
    client.release();
  }
}

// データベース接続取得
function getPool() {
  return pool;
}

// データベース終了
async function closePool() {
  await pool.end();
}

module.exports = {
  initPostgres,
  getPool,
  closePool
}; 