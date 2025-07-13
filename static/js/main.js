document.addEventListener('DOMContentLoaded', async () => {
    let user = JSON.parse(localStorage.getItem('pomodoroUser'));

    // ユーザーがいない場合、ログイン/新規登録を促す
    if (!user) {
        const username = prompt("ようこそ！ユーザー名を入力してください（新規登録またはログイン）:");
        if (username) {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            user = await response.json();
            localStorage.setItem('pomodoroUser', JSON.stringify(user));
        } else {
            document.querySelector('.container').innerHTML = '<h1>利用するにはユーザー名が必要です。リロードしてください。</h1>';
            return;
        }
    }

    // ToDoリストを読み込む
    loadTodos(user.id);
});

async function loadTodos(userId) {
    const response = await fetch(`/api/todos/${userId}`);
    const todos = await response.json();
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = ''; // リストをクリア

    if (todos.length === 0) {
        todoList.innerHTML = '<li>現在、タスクはありません。</li>';
    } else {
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.dataset.id = todo.id;
            li.innerHTML = `
                <span>${todo.task_name} (〆切: ${todo.due_date || '未設定'})</span>
                <input type="checkbox" class="complete-checkbox">
            `;
            todoList.appendChild(li);
        });
    }

    // チェックボックスにイベントリスナーを追加
    document.querySelectorAll('.complete-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async function() {
            if (this.checked) {
                const li = this.closest('li');
                const todoId = li.dataset.id;
                
                // スタイルを適用
                li.classList.add('completed');
                
                // DBで完了済みに更新
                await fetch(`/api/todos/complete/${todoId}`, { method: 'POST' });

                // 少し遅れて一番下に移動し、その後消滅させる
                setTimeout(() => {
                    todoList.appendChild(li); // 一番下に移動
                    setTimeout(() => {
                        li.remove(); // 消滅
                    }, 500); // 0.5秒後に消える
                }, 300); // 0.3秒後に移動
            }
        });
    });
}