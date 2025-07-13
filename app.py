import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Renderが提供するDATABASE_URLを環境変数から読み込む。なければローカルのSQLiteを使う（開発用）
db_url = os.environ.get('DATABASE_URL')
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url or 'sqlite:///pomodoro.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- SQLAlchemyモデル定義 ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    todos = db.relationship('Todo', backref='user', lazy=True)

class Todo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    task_name = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.String(20))
    completed = db.Column(db.Boolean, nullable=False, default=False)

# --- 画面表示のためのルーティング (変更なし) ---
@app.route('/')
def index(): return render_template('index.html')
@app.route('/add')
def add_todo_page(): return render_template('add_todo.html')
@app.route('/prepare')
def prepare_work_page(): return render_template('prepare_work.html')
@app.route('/work')
def work_session_page(): return render_template('work_session.html')


# --- APIエンドポイント (SQLAlchemyを使うように修正) ---
@app.route('/api/user', methods=['POST'])
def get_or_create_user():
    data = request.get_json()
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    user = User.query.filter_by(username=username).first()
    if user is None:
        user = User(username=username)
        db.session.add(user)
        db.session.commit()
    
    return jsonify({'id': user.id, 'username': user.username})

@app.route('/api/todos/<int:user_id>', methods=['GET', 'POST'])
def handle_todos(user_id):
    if request.method == 'POST':
        data = request.get_json()
        task_name = data.get('task_name')
        if not task_name:
            return jsonify({'error': 'Task name is required'}), 400
        
        new_todo = Todo(
            user_id=user_id,
            task_name=task_name,
            due_date=data.get('due_date')
        )
        db.session.add(new_todo)
        db.session.commit()
        return jsonify({'id': new_todo.id, 'message': 'ToDo added successfully'}), 201
    else: # GET
        todos = Todo.query.filter_by(user_id=user_id, completed=False).order_by(Todo.due_date.asc()).all()
        return jsonify([{
            'id': todo.id,
            'task_name': todo.task_name,
            'due_date': todo.due_date,
            'completed': todo.completed
        } for todo in todos])

@app.route('/api/todos/complete/<int:todo_id>', methods=['POST'])
def complete_todo(todo_id):
    todo = Todo.query.get(todo_id)
    if not todo:
        return jsonify({'error': 'ToDo not found'}), 404
    
    todo.completed = True
    db.session.commit()
    return jsonify({'message': 'ToDo marked as completed'})

# このif文はローカルでのテスト実行にのみ使われる
if __name__ == '__main__':
    with app.app_context():
        db.create_all() # ローカルのSQLite用にテーブルを作成
    app.run(debug=True)