document.addEventListener('DOMContentLoaded', () => {
    // セッション情報を取得
    const tasks = JSON.parse(sessionStorage.getItem('workSessionTasks'));
    const pomodoroTime = parseInt(localStorage.getItem('pomodoroTime'), 10);
    const breakTime = parseInt(localStorage.getItem('breakTime'), 10);

    if (!tasks || !pomodoroTime || !breakTime) {
        alert('セッション情報がありません。準備画面に戻ります。');
        window.location.href = '/prepare';
        return;
    }

    // UI要素
    const statusDisplay = document.getElementById('session-status');
    const timerDisplay = document.getElementById('timer-display');
    const nextSessionInfo = document.getElementById('next-session-info');
    const pomodoroCountDisplay = document.getElementById('pomodoro-count');
    const startStopBtn = document.getElementById('start-stop-btn');
    const quitBtn = document.getElementById('quit-btn');
    const workTaskList = document.getElementById('work-task-list');
    
    const notificationSound = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3'); // 通知音

    let state = {
        isWork: true,
        isRunning: false,
        pomodoroCount: 1,
        timeLeft: pomodoroTime * 60,
        timerInterval: null,
        completedTasks: []
    };

    // 初期表示設定
    function setupUI() {
        timerDisplay.textContent = formatTime(state.timeLeft);
        statusDisplay.textContent = 'ポモドーロ';
        nextSessionInfo.textContent = `次は 休憩 (${breakTime}分)`;
        pomodoroCountDisplay.textContent = `${state.pomodoroCount} ポモドーロ目`;
        renderTasks();
    }
    
    function renderTasks() {
        workTaskList.innerHTML = '';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.id = task.id;
            li.innerHTML = `
                <span>${task.name}</span>
                <input type="checkbox" class="complete-task-checkbox">
            `;
            workTaskList.appendChild(li);
        });
        
        // タスク完了チェックボックス
        document.querySelectorAll('.complete-task-checkbox').forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked) {
                    const li = this.closest('li');
                    li.classList.add('completed');
                    workTaskList.appendChild(li); // 一番下に移動
                    state.completedTasks.push(li.dataset.id);
                    this.disabled = true; // 再度押せないようにする
                }
            });
        });
    }
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function tick() {
        state.timeLeft--;
        timerDisplay.textContent = formatTime(state.timeLeft);
        if (state.timeLeft <= 0) {
            clearInterval(state.timerInterval);
            notificationSound.play();
            switchSession();
        }
    }

    function switchSession() {
        state.isRunning = false;
        startStopBtn.textContent = 'スタート';
        
        if (state.isWork) {
            // 作業 -> 休憩
            alert('ポモドーロ終了！休憩を開始してください。');
            state.isWork = false;
            state.timeLeft = breakTime * 60;
            statusDisplay.textContent = '休憩';
            nextSessionInfo.textContent = `次は ポモドーロ (${pomodoroTime}分)`;
        } else {
            // 休憩 -> 作業
            alert('休憩終了！次のポモドーロを開始してください。');
            state.isWork = true;
            state.pomodoroCount++;
            state.timeLeft = pomodoroTime * 60;
            statusDisplay.textContent = 'ポモドーロ';
            nextSessionInfo.textContent = `次は 休憩 (${breakTime}分)`;
            pomodoroCountDisplay.textContent = `${state.pomodoroCount} ポモドーロ目`;
        }
        timerDisplay.textContent = formatTime(state.timeLeft);
    }
    
    startStopBtn.addEventListener('click', () => {
        state.isRunning = !state.isRunning;
        if (state.isRunning) {
            startStopBtn.textContent = 'ストップ';
            state.timerInterval = setInterval(tick, 1000);
        } else {
            startStopBtn.textContent = 'スタート';
            clearInterval(state.timerInterval);
        }
    });

    quitBtn.addEventListener('click', async () => {
        clearInterval(state.timerInterval);
        const totalWorkMinutes = (state.pomodoroCount - 1) * pomodoroTime + (pomodoroTime - Math.floor(state.timeLeft / 60));

        // 完了したタスクをDBに反映
        for (const taskId of state.completedTasks) {
            await fetch(`/api/todos/complete/${taskId}`, { method: 'POST' });
        }
        
        alert(`お疲れ様でした！\n総作業時間: 約${totalWorkMinutes}分\n完了したタスク: ${state.completedTasks.length}個`);
        
        sessionStorage.removeItem('workSessionTasks');
        window.location.href = '/';
    });

    // 初期化
    setupUI();
});