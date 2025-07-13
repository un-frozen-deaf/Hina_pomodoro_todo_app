// static/js/prepare.js (全体を書き換え)

document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('pomodoroUser'));
    if (!user) {
        alert('ユーザー情報が見つかりません。');
        window.location.href = '/';
        return;
    }

    const pomodoroInput = document.getElementById('pomodoro-time');
    const breakInput = document.getElementById('break-time');

    // ★修正点: localStorageからではなく、userオブジェクトから時間を読み込む
    pomodoroInput.value = user.pomodoro_time || 25;
    breakInput.value = user.break_time || 5;

    // ... (ToDoの読み込み部分は変更なし) ...
    const selectableTodosContainer = document.getElementById('selectable-todos');
    const priorityList = document.getElementById('priority-list');
    let allTodos = [];

    const response = await fetch(`/api/todos/${user.id}`);
    allTodos = await response.json();
    
    allTodos.forEach(todo => {
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="checkbox" id="todo-${todo.id}" data-id="${todo.id}" data-name="${todo.task_name}">
            <label for="todo-${todo.id}">${todo.task_name}</label>
        `;
        selectableTodosContainer.appendChild(div);
    });

    selectableTodosContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const todoId = e.target.dataset.id;
            const todoName = e.target.dataset.name;

            if (e.target.checked) {
                const li = document.createElement('li');
                li.dataset.id = todoId;
                li.innerHTML = `
                    <span>${todoName}</span>
                    <div>
                        <button class="priority-up">↑</button>
                        <button class="priority-down">↓</button>
                    </div>
                `;
                priorityList.appendChild(li);
            } else {
                const itemToRemove = priorityList.querySelector(`li[data-id='${todoId}']`);
                if (itemToRemove) itemToRemove.remove();
            }
        }
    });
    
    priorityList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        if (e.target.classList.contains('priority-up')) {
            if (li.previousElementSibling) {
                priorityList.insertBefore(li, li.previousElementSibling);
            }
        } else if (e.target.classList.contains('priority-down')) {
            if (li.nextElementSibling) {
                priorityList.insertBefore(li.nextElementSibling, li);
            }
        }
    });

    // ★修正点: 作業開始ボタンの処理を修正
    document.getElementById('start-work-btn').addEventListener('click', async () => {
        const pomodoroTime = pomodoroInput.value;
        const breakTime = breakInput.value;
        
        const prioritizedTasks = Array.from(priorityList.querySelectorAll('li')).map(li => ({
            id: li.dataset.id,
            name: li.querySelector('span').textContent
        }));

        if (prioritizedTasks.length === 0) {
            alert('少なくとも1つのタスクを選択してください。');
            return;
        }
        if (!pomodoroTime || !breakTime || pomodoroTime <= 0 || breakTime <= 0) {
            alert('時間には正の数を入力してください。');
            return;
        }
        
        // --- ★追加点: DBに新しい時間設定を保存 ---
        const settings = {
            user_id: user.id,
            pomodoro_time: pomodoroTime,
            break_time: breakTime,
        };
        await fetch('/api/user/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });

        // --- ★追加点: localStorageのユーザー情報と時間設定も更新 ---
        user.pomodoro_time = pomodoroTime;
        user.break_time = breakTime;
        localStorage.setItem('pomodoroUser', JSON.stringify(user));
        localStorage.setItem('pomodoroTime', pomodoroTime);
        localStorage.setItem('breakTime', breakTime);

        sessionStorage.setItem('workSessionTasks', JSON.stringify(prioritizedTasks));
        
        window.location.href = '/work';
    });
});