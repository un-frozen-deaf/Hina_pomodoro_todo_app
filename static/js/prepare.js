document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('pomodoroUser'));
    if (!user) {
        alert('ユーザー情報が見つかりません。');
        window.location.href = '/';
        return;
    }

    // 前回使用した時間をlocalStorageから読み込む
    const lastPomodoroTime = localStorage.getItem('pomodoroTime') || 25;
    const lastBreakTime = localStorage.getItem('breakTime') || 5;
    document.getElementById('pomodoro-time').value = lastPomodoroTime;
    document.getElementById('break-time').value = lastBreakTime;

    const selectableTodosContainer = document.getElementById('selectable-todos');
    const priorityList = document.getElementById('priority-list');
    let allTodos = [];

    // ToDoを読み込み
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

    // チェックボックスの変更を監視
    selectableTodosContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const todoId = e.target.dataset.id;
            const todoName = e.target.dataset.name;

            if (e.target.checked) {
                // 優先度リストに追加
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
                // 優先度リストから削除
                const itemToRemove = priorityList.querySelector(`li[data-id='${todoId}']`);
                if (itemToRemove) {
                    itemToRemove.remove();
                }
            }
        }
    });
    
    // 優先度変更（上下矢印）
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

    // 作業開始ボタン
    document.getElementById('start-work-btn').addEventListener('click', () => {
        const pomodoroTime = document.getElementById('pomodoro-time').value;
        const breakTime = document.getElementById('break-time').value;
        
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
        
        // 設定とタスクをsessionStorageに保存して次の画面へ
        localStorage.setItem('pomodoroTime', pomodoroTime);
        localStorage.setItem('breakTime', breakTime);
        sessionStorage.setItem('workSessionTasks', JSON.stringify(prioritizedTasks));
        
        window.location.href = '/work';
    });
});