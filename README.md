# Class1 Admin System

ECG・JCGのClass1管理システムです。講師とマネージャーが生徒の進捗を管理し、アンケートを収集できるWebアプリケーションです。

## 機能

### 講師機能
- 生徒の週次チェックリスト管理
- レッスン実施日の記録
- DM調整日の記録
- カレンダー表示

### マネージャー機能
- 生徒一覧管理
- 月次入金状況管理
- アンケート回答状況管理
- アンケート結果閲覧

### 生徒機能
- オンラインアンケート回答
- 多言語対応（日本語・英語）

## 技術スタック

### フロントエンド
- HTML5
- CSS3 (カスタムプロパティ、レスポンシブデザイン)
- Vanilla JavaScript
- ダークモード/ライトモード対応

### バックエンド
- Node.js
- Express.js
- SQLite3
- JWT認証

## セットアップ

### バックエンド（Render）

1. Renderで新しいWeb Serviceを作成
2. GitHubリポジトリを接続
3. 環境変数を設定：
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: 安全なJWTシークレットキー
4. Build Command: `cd backend && npm install`
5. Start Command: `cd backend && npm start`

### フロントエンド（GitHub Pages）

1. GitHubリポジトリのSettings > Pages
2. Source: Deploy from a branch
3. Branch: main
4. Folder: /frontend

## 開発環境

### バックエンド
```bash
cd backend
npm install
npm run dev
```

### フロントエンド
```bash
cd frontend
# ブラウザでindex.htmlを開く
```

## API エンドポイント

### 講師管理
- `GET /api/instructors` - 講師一覧取得
- `POST /api/instructors` - 講師追加
- `DELETE /api/instructors/:id` - 講師削除

### 生徒管理
- `GET /api/students` - 生徒一覧取得
- `POST /api/students` - 生徒追加
- `PUT /api/students/:id` - 生徒更新
- `DELETE /api/students/:id` - 生徒削除
- `GET /api/students/next-member-number` - 次の会員番号取得

### 週次チェック
- `GET /api/weekly/:weekKey` - 週次データ取得
- `POST /api/weekly/:weekKey/:studentId` - 週次データ更新

### 月次チェック
- `GET /api/monthly/:monthKey` - 月次データ取得
- `POST /api/monthly/:monthKey/:studentId` - 月次データ更新
- `GET /api/monthly/manager/:monthKey` - マネージャー用月次データ

### アンケート
- `GET /api/surveys` - アンケート一覧取得
- `POST /api/surveys` - アンケート送信
- `GET /api/surveys/month/:monthKey` - 月別アンケート取得
- `GET /api/surveys/search/:query` - アンケート検索

### 認証
- `POST /api/auth/login` - ログイン
- `POST /api/auth/register` - ユーザー登録
- `GET /api/auth/profile` - プロフィール取得

## データベース構造

### instructors
- id (TEXT, PRIMARY KEY)
- name (TEXT, NOT NULL)
- created_at (DATETIME)

### students
- id (TEXT, PRIMARY KEY)
- name (TEXT, NOT NULL)
- instructor_id (TEXT, FOREIGN KEY)
- member_number (TEXT, UNIQUE)
- email (TEXT)
- note (TEXT)
- created_at (DATETIME)

### weekly_checks
- id (INTEGER, PRIMARY KEY)
- week_key (TEXT, NOT NULL)
- student_id (TEXT, NOT NULL)
- dm (BOOLEAN)
- dm_date (TEXT)
- lesson (BOOLEAN)
- lesson_date (TEXT)
- created_at (DATETIME)

### monthly_checks
- id (INTEGER, PRIMARY KEY)
- month_key (TEXT, NOT NULL)
- student_id (TEXT, NOT NULL)
- paid (BOOLEAN)
- last_paid (TEXT)
- survey (BOOLEAN)
- created_at (DATETIME)

### surveys
- id (INTEGER, PRIMARY KEY)
- member_number (TEXT, NOT NULL)
- student_name (TEXT)
- satisfaction (INTEGER)
- nps_score (INTEGER)
- instructor_feedback (TEXT)
- lesson_feedback (TEXT)
- learning_goals (TEXT)
- other_feedback (TEXT)
- submitted_at (DATETIME)

### users
- id (INTEGER, PRIMARY KEY)
- username (TEXT, UNIQUE, NOT NULL)
- password_hash (TEXT, NOT NULL)
- role (TEXT, NOT NULL)
- created_at (DATETIME)

## ライセンス

このプロジェクトはECG・JCG専用です。 