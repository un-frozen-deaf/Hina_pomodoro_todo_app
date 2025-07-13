// static/js/work.js (全体を書き換え)

document.addEventListener('DOMContentLoaded', () => {
    // --- モーダル関連の要素を取得 ---
    const timerEndModal = document.getElementById('timer-end-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');

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
    
    // 通知音はそのまま利用
    const notificationSound = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3');

    let state = {
        isWork: true,
        isRunning: false,
        pomodoroCount: 1,
        timeLeft: pomodoroTime * 60,
        timerInterval: null,
        completedTasks: []
    };

    // --- 新しいモーダル表示関数 ---
    function showTimerModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        timerEndModal.style.display = 'flex';
    }

    // モーダルの閉じるボタンの処理
    modalCloseBtn.addEventListener('click', () => {
        timerEndModal.style.display = 'none';
        // ユーザーがモーダルを閉じたら、次のセッションを開始する準備ができたことを示す
        // 実際のタイマースタートは、ユーザーが再度「スタート」ボタンを押すことで行われる
    });

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
        
        document.querySelectorAll('.complete-task-checkbox').forEach(cb => {
            cb.addEventListener('change', async function() { // asyncを追加
                if (this.checked) {
                    const li = this.closest('li');
                    li.classList.add('completed');
                    workTaskList.appendChild(li); 
                    
                    const taskId = li.dataset.id;
                    state.completedTasks.push(taskId);
                    this.disabled = true;

                    // ★修正点: タスク完了を即時DBに反映
                    await fetch(`/api/todos/complete/${taskId}`, { method: 'POST' });
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
        document.title = `${formatTime(state.timeLeft)} - ${state.isWork ? '作業中' : '休憩中'}`; // ★ページタイトル更新を追加

        if (state.timeLeft <= 0) {
            clearInterval(state.timerInterval);
            notificationSound.play();
            switchSession();
        }
    }

    // --- switchSession関数をモーダル対応に修正 ---
    function switchSession() {
        state.isRunning = false;
        startStopBtn.textContent = 'スタート';
        document.title = 'ポモドーロタイマー'; // 元のタイトルに戻す
        
        if (state.isWork) {
            // 作業 -> 休憩
            state.isWork = false;
            state.timeLeft = breakTime * 60;
            statusDisplay.textContent = '休憩';
            nextSessionInfo.textContent = `次は ポモドーロ (${pomodoroTime}分)`;
            showTimerModal('ポモドーロ終了！', `お疲れ様でした。${breakTime}分間の休憩に入ります。`);
        } else {
            // 休憩 -> 作業
            state.isWork = true;
            state.pomodoroCount++;
            state.timeLeft = pomodoroTime * 60;
            statusDisplay.textContent = 'ポモドーロ';
            nextSessionInfo.textContent = `次は 休憩 (${breakTime}分)`;
            pomodoroCountDisplay.textContent = `${state.pomodoroCount} ポモドーロ目`;
            showTimerModal('休憩終了！', '次の作業セッションを開始しましょう。');
        }
        // 次のセッションの時間を表示
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

    quitBtn.addEventListener('click', () => { // asyncは不要に
        clearInterval(state.timerInterval);
        const totalWorkMinutes = (state.pomodoroCount - 1) * pomodoroTime + (pomodoroTime - Math.floor(state.timeLeft / 60));

        // タスク完了は都度DBに反映されるため、ここでの一括処理は不要に
        
        alert(`お疲れ様でした！\n総作業時間: 約${totalWorkMinutes}分\n完了したタスク: ${state.completedTasks.length}個`);
        
        sessionStorage.removeItem('workSessionTasks');
        window.location.href = '/';
    });

    // 初期化
    setupUI();
});