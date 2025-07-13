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
    # ★修正点: 時間を保存するカラムを追加 (デフォルト値を設定)
    pomodoro_time = db.Column(db.Integer, nullable=False, default=25)
    break_time = db.Column(db.Integer, nullable=False, default=5)

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
        user = User(username=username) # デフォルト値(25, 5)で作成される
        db.session.add(user)
        db.session.commit()
    
    # 時間の情報も含めて返すようにする
    return jsonify({
        'id': user.id, 
        'username': user.username,
        'pomodoro_time': user.pomodoro_time,
        'break_time': user.break_time
    })
    
@app.route('/api/user/settings', methods=['POST'])
def update_user_settings():
    data = request.get_json()
    user_id = data.get('user_id')
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    user.pomodoro_time = data.get('pomodoro_time', user.pomodoro_time)
    user.break_time = data.get('break_time', user.break_time)
    db.session.commit()
    
    return jsonify({'message': 'Settings updated successfully'})
    
    
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
    

# --- 既存のAPIエンドポイントの下に、以下の2つを追加 ---

# 全ユーザーのリストを取得するAPI
@app.route('/api/users', methods=['GET'])
def get_all_users():
    try:
        users = User.query.all()
        return jsonify([{'id': user.id, 'username': user.username} for user in users])
    except Exception as e:
        # エラーログを出力するとデバッグに役立ちます
        print(f"Error fetching users: {e}")
        return jsonify({'error': 'Could not fetch users'}), 500

# ユーザーを削除するAPI
@app.route('/api/user/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # ユーザーに関連するToDoをすべて削除
    Todo.query.filter_by(user_id=user_id).delete()
    
    # ユーザー自身を削除
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User and all associated tasks deleted successfully'})

@app.route('/api/todo/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    todo = Todo.query.get(todo_id)
    if not todo:
        return jsonify({'error': 'ToDo not found'}), 404
        
    data = request.get_json()
    new_task_name = data.get('task_name')
    new_due_date = data.get('due_date')

    if not new_task_name:
        return jsonify({'error': 'Task name is required'}), 400
        
    todo.task_name = new_task_name
    todo.due_date = new_due_date
    db.session.commit()
    
    return jsonify({'message': 'ToDo updated successfully'})

# ★追加点: 日付を扱うためにdatetimeをインポート
from datetime import date

# ... (既存のUser, Todoモデル定義の下に追記) ...

# ★追加点: 完了済みタスクを記録するモデル
class CompletedTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    task_name = db.Column(db.String(200), nullable=False)
    completed_at = db.Column(db.Date, nullable=False, default=date.today)

# ... (既存のAPIエンドポイントを修正・追記) ...

# ★修正点: タスク完了API (/api/todos/complete/<int:todo_id>) を修正
@app.route('/api/todos/complete/<int:todo_id>', methods=['POST'])
def complete_todo(todo_id):
    todo = Todo.query.get(todo_id)
    if not todo:
        return jsonify({'error': 'ToDo not found'}), 404
    
    # 完了済みタスクテーブルに記録
    completed = CompletedTask(
        user_id=todo.user_id,
        task_name=todo.task_name
    )
    db.session.add(completed)
    
    # 元のToDoは削除する
    db.session.delete(todo)
    db.session.commit()
    
    return jsonify({'message': 'ToDo moved to completed tasks'})

# ★追加点: 完了済みタスクの統計データを返すAPI
@app.route('/api/stats/<int:user_id>', methods=['GET'])
def get_stats(user_id):
    # 直近7日間の日別完了タスク数を集計
    from sqlalchemy import func, text
    from datetime import timedelta

    today = date.today()
    seven_days_ago = today - timedelta(days=6)

    # 日付ごとにグループ化してカウント
    stats_data = db.session.query(
        CompletedTask.completed_at,
        func.count(CompletedTask.id)
    ).filter(
        CompletedTask.user_id == user_id,
        CompletedTask.completed_at >= seven_days_ago
    ).group_by(
        CompletedTask.completed_at
    ).order_by(
        CompletedTask.completed_at
    ).all()
    
    # 日付ラベルとデータを作成
    labels = [(today - timedelta(days=i)).strftime('%m/%d') for i in range(6, -1, -1)]
    data_map = {stat.completed_at.strftime('%m/%d'): stat[1] for stat in stats_data}
    counts = [data_map.get(label, 0) for label in labels]

    # 最近完了したタスク5件
    recent_tasks = CompletedTask.query.filter_by(
        user_id=user_id
    ).order_by(
        CompletedTask.completed_at.desc()
    ).limit(5).all()

    return jsonify({
        'chart_labels': labels,
        'chart_data': counts,
        'recent_tasks': [{'task_name': task.task_name, 'completed_at': task.completed_at.strftime('%Y-%m-%d')} for task in recent_tasks]
    })


# ★追加点: 履歴ページへのルーティング
@app.route('/history')
def history_page():
    return render_template('history.html')
