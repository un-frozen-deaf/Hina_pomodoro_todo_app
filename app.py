from flask import Flask, render_template, request, jsonify, g
import sqlite3

app = Flask(__name__)
DATABASE = 'pomodoro.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row # カラム名でアクセスできるようにする
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not in None:
        db.close()

# --- 画面表示のためのルーティング ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/add')
def add_todo_page():
    return render_template('add_todo.html')

@app.route('/prepare')
def prepare_work_page():
    return render_template('prepare_work.html')

@app.route('/work')
def work_session_page():
    return render_template('work_session.html')

# --- APIエンドポイント ---

# ユーザーのログイン/登録
@app.route('/api/user', methods=['POST'])
def get_or_create_user():
    data = request.get_json()
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    if user is None:
        cursor.execute('INSERT INTO users (username) VALUES (?)', (username,))
        db.commit()
        user_id = cursor.lastrowid
    else:
        user_id = user['id']
    
    return jsonify({'id': user_id, 'username': username})

# ToDoリストの取得と追加
@app.route('/api/todos/<int:user_id>', methods=['GET', 'POST'])
def handle_todos(user_id):
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'POST':
        data = request.get_json()
        task_name = data.get('task_name')
        due_date = data.get('due_date')
        if not task_name:
            return jsonify({'error': 'Task name is required'}), 400
        
        cursor.execute('INSERT INTO todos (user_id, task_name, due_date) VALUES (?, ?, ?)',
                        (user_id, task_name, due_date))
        db.commit()
        return jsonify({'id': cursor.lastrowid, 'message': 'ToDo added successfully'}), 201

    else: # GET
        cursor.execute('SELECT * FROM todos WHERE user_id = ? AND completed = 0 ORDER BY due_date ASC', (user_id,))
        todos = [dict(row) for row in cursor.fetchall()]
        return jsonify(todos)

# ToDoの完了（削除の代わり）
@app.route('/api/todos/complete/<int:todo_id>', methods=['POST'])
def complete_todo(todo_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('UPDATE todos SET completed = 1 WHERE id = ?', (todo_id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({'error': 'ToDo not found'}), 404
    return jsonify({'message': 'ToDo marked as completed'})

if __name__ == '__main__':
    app.run(debug=True)