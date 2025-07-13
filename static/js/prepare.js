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

    pomodoroInput.value = user.pomodoro_time || 25;
    breakInput.value = user.break_time || 5;

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
                // ★修正点: ドラッグ可能にするために draggable="true" を追加
                li.draggable = true;
                // ★修正点: 矢印ボタンを削除
                li.innerHTML = `<span>${todoName}</span>`;
                priorityList.appendChild(li);
            } else {
                const itemToRemove = priorityList.querySelector(`li[data-id='${todoId}']`);
                if (itemToRemove) itemToRemove.remove();
            }
        }
    });
    
    // ★追加点: ドラッグ＆ドロップのイベントリスナー
    let draggedItem = null;

    priorityList.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        // ドラッグ中の要素にスタイルを適用（任意）
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
    });

    priorityList.addEventListener('dragend', (e) => {
        // スタイルを元に戻す
        e.target.style.opacity = '1';
        draggedItem = null;
    });

    priorityList.addEventListener('dragover', (e) => {
        e.preventDefault(); // デフォルトの動作をキャンセル
        const afterElement = getDragAfterElement(priorityList, e.clientY);
        if (afterElement == null) {
            priorityList.appendChild(draggedItem);
        } else {
            priorityList.insertBefore(draggedItem, afterElement);
        }
    });

    // ドラッグ先の位置を計算するヘルパー関数
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

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

        user.pomodoro_time = pomodoroTime;
        user.break_time = breakTime;
        localStorage.setItem('pomodoroUser', JSON.stringify(user));
        localStorage.setItem('pomodoroTime', pomodoroTime);
        localStorage.setItem('breakTime', breakTime);

        sessionStorage.setItem('workSessionTasks', JSON.stringify(prioritizedTasks));
        
        window.location.href = '/work';
    });
});