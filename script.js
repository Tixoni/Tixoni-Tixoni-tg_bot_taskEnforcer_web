const API_BASE_URL = "https://твой-адрес-из-ngrok.ngrok-free.app"; 

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const userId = tg.initDataUnsafe.user?.id || 999;

// Проверка регистрации
(async function init() {
    if (localStorage.getItem('user_registered')) {
        showTasksScreen();
    } else {
        document.getElementById('reg-screen').classList.remove('hidden');
    }
})();

// Регистрация пользователя 
async function register() {
    const name = document.getElementById('username').value;
    if (!name) return tg.showAlert("Имя введи!");

    try {
        const res = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tg_id: userId, name: name })
        });
        
        if (res.ok) {
            localStorage.setItem('user_registered', 'true');
            showTasksScreen();
        }
    } catch (e) {
        tg.showAlert("Сервер спит или ngrok сдох");
    }
}

// Загрузка списка задач 
async function loadTasks() {
    const list = document.getElementById('tasks-list');
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);
        const tasks = await res.json();
        
        list.innerHTML = '';
        tasks.forEach(task => {
            const div = document.createElement('div');
            div.className = 'card p-4 rounded-xl flex items-center justify-between shadow-sm';
            div.innerHTML = `
                <span class="${task.is_completed ? 'task-completed' : ''}">${task.title}</span>
                <input type="checkbox" ${task.is_completed ? 'checked' : ''} 
                    onclick="toggleTask(${task.id})">
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.error("Ошибка загрузки задач:", e);
    }
}

// Добавление новой задачи 
async function addNewTask() {
    const input = document.getElementById('task-input');
    if (!input.value) return;

    await fetch(`${API_BASE_URL}/api/tasks/add`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId, title: input.value })
    });
    
    input.value = '';
    loadTasks();
}

// Переключение статуса 
async function toggleTask(taskId) {
    await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, { method: 'POST' });
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    loadTasks();
}

function showTasksScreen() {
    document.getElementById('reg-screen').classList.add('hidden');
    document.getElementById('tasks-screen').classList.remove('hidden');
    loadTasks();
}