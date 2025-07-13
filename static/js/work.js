// static/js/work.js (全体を書き換え)

document.addEventListener('DOMContentLoaded', () => {
    const timerEndModal = document.getElementById('timer-end-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // ★修正点: sessionStorageのキーを定義
    const SESSION_STORAGE_KEY = 'pomodoroSessionState';

    const pomodoroTime = parseInt(localStorage.getItem('pomodoroTime'), 10);
    const breakTime = parseInt(localStorage.getItem('breakTime'), 10);

    // ページ読み込み時のタスクリストの取得元をsessionStorageに変更
    const tasks = JSON.parse(sessionStorage.getItem('workSessionTasks'));
    
    if (!tasks || !pomodoroTime || !breakTime) {
        alert('セッション情報がありません。準備画面に戻ります。');
        window.location.href = '/prepare';
        return;
    }

    const statusDisplay = document.getElementById('session-status');
    const timerDisplay = document.getElementById('timer-display');
    const nextSessionInfo = document.getElementById('next-session-info');
    const pomodoroCountDisplay = document.getElementById('pomodoro-count');
    const startStopBtn = document.getElementById('start-stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    const quitBtn = document.getElementById('quit-btn');
    const workTaskList = document.getElementById('work-task-list');
    const notificationSound = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3');

    let state = {
        isWork: true,
        isRunning: false,
        pomodoroCount: 1,
        timeLeft: pomodoroTime * 60,
        timerInterval: null,
        completedTasks: []
    };

    // ★修正点: 状態を保存する関数
    function saveState() {
        // timerIntervalは保存できないので除外
        const stateToSave = { ...state, timerInterval: null };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stateToSave));
    }

    // ★修正点: 状態を読み込む関数
    function loadState() {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedState) {
            // 保存された状態があれば、現在のstateを上書き
            state = JSON.parse(savedState);
            // ページリロード後はタイマーが止まっているので、isRunningをfalseに設定
            state.isRunning = false; 
        } else {
            // 保存されたstateがない場合（セッションの初回開始時）
            saveState(); // 初期状態を保存
        }
    }

    function showTimerModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        timerEndModal.style.display = 'flex';
    }

    modalCloseBtn.addEventListener('click', () => {
        timerEndModal.style.display = 'none';
    });

    // UIを現在のstateに基づいて更新する関数
    function updateUI() {
        timerDisplay.textContent = formatTime(state.timeLeft);
        document.title = `${formatTime(state.timeLeft)} - ${state.isWork ? '作業中' : '休憩中'}`;

        statusDisplay.textContent = state.isWork ? 'ポモドーロ' : '休憩';
        nextSessionInfo.textContent = `次は ${state.isWork ? '休憩' : 'ポモドーロ'} (${state.isWork ? breakTime : pomodoroTime}分)`;
        pomodoroCountDisplay.textContent = `${state.pomodoroCount} ポモドーロ目`;
        startStopBtn.textContent = state.isRunning ? 'ストップ' : 'スタート';
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
            // ★修正点: 完了済みタスクの状態を復元
            if (state.completedTasks.includes(task.id)) {
                li.classList.add('completed');
                li.querySelector('.complete-task-checkbox').checked = true;
                li.querySelector('.complete-task-checkbox').disabled = true;
            }
            workTaskList.appendChild(li);
        });
        
        document.querySelectorAll('.complete-task-checkbox').forEach(cb => {
            cb.addEventListener('change', async function() {
                if (this.checked) {
                    const li = this.closest('li');
                    li.classList.add('completed');
                    workTaskList.appendChild(li); 
                    
                    const taskId = li.dataset.id;
                    // ★修正点: stateにも完了タスクを記録
                    if (!state.completedTasks.includes(taskId)) {
                        state.completedTasks.push(taskId);
                    }
                    saveState(); // 状態を保存
                    this.disabled = true;

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
        updateUI(); // UI更新を共通関数に
        saveState(); // ★修正点: 1秒ごとに状態を保存

        if (state.timeLeft <= 0) {
            clearInterval(state.timerInterval);
            notificationSound.play();
            switchSession();
        }
    }

    function switchSession() {
        state.isRunning = false;
        document.title = 'ポモドーロタイマー'; 
        
        if (state.isWork) {
            state.isWork = false;
            state.timeLeft = breakTime * 60;
            showTimerModal('ポモドーロ終了！', `お疲れ様でした。${breakTime}分間の休憩に入ります。`);
        } else {
            state.isWork = true;
            state.pomodoroCount++;
            state.timeLeft = pomodoroTime * 60;
            showTimerModal('休憩終了！', '次の作業セッションを開始しましょう。');
        }
        updateUI();
        saveState(); // ★修正点: セッション切り替え後にも状態を保存
    }
    
    startStopBtn.addEventListener('click', () => {
        state.isRunning = !state.isRunning;
        if (state.isRunning) {
            state.timerInterval = setInterval(tick, 1000);
        } else {
            clearInterval(state.timerInterval);
        }
        updateUI();
    });

    resetBtn.addEventListener('click', () => {
        // 確認ダイアログを表示
        if (confirm('現在のタイマーをリセットしますか？')) {
            // タイマーを停止
            clearInterval(state.timerInterval);
            state.isRunning = false;

            // 現在のセッションに応じて残り時間をリセット
            if (state.isWork) {
                state.timeLeft = pomodoroTime * 60;
            } else {
                state.timeLeft = breakTime * 60;
            }

            // UIを更新してリセット状態を反映
            updateUI();
            // 状態を保存
            saveState();
        }
    });

    quitBtn.addEventListener('click', () => {
        clearInterval(state.timerInterval);
        // ★修正点: セッション情報をクリア
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        sessionStorage.removeItem('workSessionTasks');
        
        alert(`お疲れ様でした！`);
        window.location.href = '/';
    });

    // --- 初期化処理 ---
    loadState(); // ★修正点: ページ読み込み時にまず状態を復元
    updateUI();  // ★修正点: 復元した状態をUIに反映
    renderTasks();
});