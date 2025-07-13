import sqlite3

# データベースに接続（なければ作成される）
conn = sqlite3.connect('pomodoro.db')
cursor = conn.cursor()

# ユーザーテーブルの作成
cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
)
''')

# ToDoテーブルの作成
cursor.execute('''
CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    task_name TEXT NOT NULL,
    due_date TEXT,
    completed BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id)
)
''')

# 変更をコミットして接続を閉じる
conn.commit()
conn.close()

print("Database 'pomodoro.db' and tables created successfully.")