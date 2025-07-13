// --------------------------------------------------------------------------
// メインの処理
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // アプリケーションのログインフローを開始
    handleLogin();

    // 編集モーダルのフォームとボタンを取得
    const editForm = document.getElementById('edit-todo-form');
    const editModal = document.getElementById('edit-todo-modal');
    const cancelBtn = document.getElementById('edit-modal-cancel-btn');

    // 編集フォームの「更新」ボタンが押されたときの処理
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const todoId = document.getElementById('edit-todo-id').value;
        const taskName = document.getElementById('edit-task-name').value;
        const dueDate = document.getElementById('edit-due-date').value;
        const color = document.getElementById('edit-task-color').value;

        const response = await fetch(`/api/todo/${todoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_name: taskName,
                due_date: dueDate,
                color: color
            })
        });

        if (response.ok) {
            editModal.style.display = 'none';
            const user = JSON.parse(localStorage.getItem('pomodoroUser'));
            loadTodos(user.id); // リストを再読み込みして変更を反映
        } else {
            alert('タスクの更新に失敗しました。');
        }
    });

    // 編集フォームの「キャンセル」ボタンが押されたときの処理
    cancelBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });
});

// --------------------------------------------------------------------------
// ログイン・ユーザー管理関連の関数
// --------------------------------------------------------------------------

/**
 * ログイン状態を確認し、必要ならログインモーダルを表示する
 */
async function handleLogin() {
    let user = JSON.parse(localStorage.getItem('pomodoroUser'));

    if (!user) {
        await showLoginModal();
    } else {
        const response = await fetch('/api/users');
        const users = await response.json();
        const userExists = users.some(u => u.id === user.id);

        if (userExists) {
            initializeApp(user);
        } else {
            alert('ユーザー情報がデータベースに見つかりませんでした。再度ログインしてください。');
            localStorage.removeItem('pomodoroUser');
            await showLoginModal();
        }
    }
}

/**
 * ログインモーダルを表示し、既存ユーザーのリストを生成する
 */
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

/**
 * 新しいユーザーを作成する
 */
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

/**
 * ユーザーを選択し、ログイン状態にする
 * @param {object} user - 選択されたユーザーオブジェクト
 */
function selectUser(user) {
    localStorage.setItem('pomodoroUser', JSON.stringify(user));
    document.getElementById('login-modal').style.display = 'none';
    initializeApp(user);
}

/**
 * ログイン後のアプリケーションを初期化する
 * @param {object} user - ログイン中のユーザーオブジェクト
 */
function initializeApp(user) {
    displayUserInfo(user);
    loadTodos(user.id);

    // ソート用ドロップダウンのイベントリスナーを設定
    const sortSelect = document.getElementById('sort-todos');
    const savedSort = localStorage.getItem('todoSortOrder');
    if (savedSort) {
        sortSelect.value = savedSort;
    }

    sortSelect.addEventListener('change', () => {
        localStorage.setItem('todoSortOrder', sortSelect.value);
        loadTodos(user.id);
    });
}

/**
 * 画面右上にユーザー情報を表示する
 * @param {object} user - ログイン中のユーザーオブジェクト
 */
function displayUserInfo(user) {
    const userInfoDiv = document.getElementById('user-info');
    userInfoDiv.innerHTML = `
        <span>ようこそ、<strong>${user.username}</strong> さん</span>
        <button id="change-user-btn" class="button-secondary">変更</button>
        <button id="delete-user-btn" class="button-danger">削除</button>
    `;

    document.getElementById('change-user-btn').onclick = () => {
        localStorage.removeItem('pomodoroUser');
        window.location.reload();
    };

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

// --------------------------------------------------------------------------
// ToDoリスト関連の関数
// --------------------------------------------------------------------------

/**
 * ToDoリストをサーバーから読み込み、画面に表示する
 * @param {number} userId - ログイン中のユーザーID
 */
async function loadTodos(userId) {
    const sortOrder = document.getElementById('sort-todos').value;
    const response = await fetch(`/api/todos/${userId}?sort=${sortOrder}`);
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
                <div class="color-bar"></div>
                <div class="task-content">
                    <span>${todo.task_name}</span>
                    <small>(〆切: ${todo.due_date || '未設定'})</small>
                </div>
                <div class="task-buttons">
                    <button class="edit-btn">編集</button>
                    <input type="checkbox" class="complete-checkbox" title="完了">
                </div>
            `;
            li.querySelector('.color-bar').style.backgroundColor = todo.color;
            todoList.appendChild(li);

            li.querySelector('.edit-btn').addEventListener('click', () => {
                openEditModal(todo);
            });
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

/**
 * 編集モーダルを開き、選択したタスクの情報をセットする
 * @param {object} todo - 編集対象のToDoオブジェクト
 */
function openEditModal(todo) {
    document.getElementById('edit-todo-id').value = todo.id;
    document.getElementById('edit-task-name').value = todo.task_name;
    document.getElementById('edit-due-date').value = todo.due_date;
    document.getElementById('edit-task-color').value = todo.color;
    document.getElementById('edit-todo-modal').style.display = 'flex';
}
