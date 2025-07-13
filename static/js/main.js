document.addEventListener('DOMContentLoaded', () => {
    handleLogin();
});

// ログイン処理のメイン関数
async function handleLogin() {
    let user = JSON.parse(localStorage.getItem('pomodoroUser'));

    if (!user) {
        await showLoginModal();
    } else {
        // ユーザー情報がある場合でも、そのユーザーがDBに存在するか確認
        const response = await fetch('/api/users');
        const users = await response.json();
        const userExists = users.some(u => u.id === user.id);

        if (userExists) {
            initializeApp(user);
        } else {
            // DBにユーザーが存在しない場合は、ストレージをクリアしてログインモーダルを表示
            alert('ユーザー情報がデータベースに見つかりませんでした。再度ログインしてください。');
            localStorage.removeItem('pomodoroUser');
            await showLoginModal();
        }
    }
}

// ログインモーダルを表示する関数
async function showLoginModal() {
    const modal = document.getElementById('login-modal');
    const usersListDiv = document.getElementById('existing-users-list');
    usersListDiv.innerHTML = '<h4>既存のユーザー</h4>';

    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch users.');
        const users = await response.json();

        if (users.length > 0) {
            users.forEach(user => {
                const userBtn = document.createElement('button');
                userBtn.className = 'user-select-btn';
                userBtn.textContent = user.username;
                userBtn.onclick = () => selectUser(user);
                usersListDiv.appendChild(userBtn);
            });
        } else {
            usersListDiv.innerHTML += '<p>現在登録されているユーザーはいません。</p>';
        }

    } catch (error) {
        console.error(error);
        usersListDiv.innerHTML += '<p>ユーザーの読み込みに失敗しました。</p>';
    }

    document.getElementById('create-new-user-btn').onclick = createNewUser;
    modal.style.display = 'flex';
}

// 新規ユーザーを作成する関数
async function createNewUser() {
    const username = prompt("新しいユーザー名を入力してください:");
    if (username) {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });
        if (response.ok) {
            const newUser = await response.json();
            selectUser(newUser);
        } else {
            alert('ユーザーの作成に失敗しました。その名前は既に使用されている可能性があります。');
        }
    }
}

// ユーザーを選択（ログイン）したときの処理
function selectUser(user) {
    localStorage.setItem('pomodoroUser', JSON.stringify(user));
    document.getElementById('login-modal').style.display = 'none';
    initializeApp(user);
}

// ログイン後のアプリケーション初期化
function initializeApp(user) {
    displayUserInfo(user);
    loadTodos(user.id);
}

// ユーザー情報を右上に表示する関数
function displayUserInfo(user) {
    const userInfoDiv = document.getElementById('user-info');
    userInfoDiv.innerHTML = `
        <span>ようこそ、<strong>${user.username}</strong> さん</span>
        <button id="change-user-btn" class="button-secondary">変更</button>
        <button id="delete-user-btn" class="button-danger">削除</button>
    `;

    // ユーザー変更ボタン
    document.getElementById('change-user-btn').onclick = () => {
        localStorage.removeItem('pomodoroUser');
        window.location.reload();
    };

    // ユーザー削除ボタン
    document.getElementById('delete-user-btn').onclick = async () => {
        const confirmation = confirm(
            `本当にユーザー「${user.username}」を削除しますか？\nこのユーザーに関連するすべてのToDoタスクも完全に削除され、元に戻せません。`
        );
        if (confirmation) {
            const response = await fetch(`/api/user/${user.id}`, { method: 'DELETE' });
            if (response.ok) {
                alert('ユーザーを削除しました。');
                localStorage.removeItem('pomodoroUser');
                window.location.reload();
            } else {
                alert('ユーザーの削除に失敗しました。');
            }
        }
    };
}


// ToDoリストを読み込む関数（以前のものと同じ、変更なし）
async function loadTodos(userId) {
    const response = await fetch(`/api/todos/${userId}`);
    const todos = await response.json();
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = ''; 

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

    document.querySelectorAll('.complete-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async function() {
            if (this.checked) {
                const li = this.closest('li');
                const todoId = li.dataset.id;
                
                li.classList.add('completed');
                
                await fetch(`/api/todos/complete/${todoId}`, { method: 'POST' });

                setTimeout(() => {
                    todoList.appendChild(li);
                    setTimeout(() => {
                        li.remove(); 
                    }, 500); 
                }, 300); 
            }
        });
    });
}