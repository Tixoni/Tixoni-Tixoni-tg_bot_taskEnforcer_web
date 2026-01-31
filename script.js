const API_BASE_URL = "https://tgbottaskenforcer-production.up.railway.app";

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const userId = tg.initDataUnsafe.user?.id;

if (!userId) {
    tg.showAlert("Не удалось получить Telegram ID");
    throw new Error("No Telegram user id");
}

// Инициализация
(async function init() {
    if (localStorage.getItem('user_registered') === 'true') {
        showTasksScreen();
    } else {
        document.getElementById('reg-screen').classList.remove('hidden');
    }
})();

// ================= REGISTRATION =================
async function register() {
    const name = document.getElementById('username').value.trim();
    if (!name) {
        tg.showAlert("Имя введи");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tg_id: userId, name })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("API error:", text);
            tg.showAlert("Ошибка регистрации: " + text);
            return;
        }

        localStorage.setItem('user_registered', 'true');
        showTasksScreen();

    } catch (e) {
        console.error("Network error:", e);
        tg.showAlert("Сеть недоступна или сервер не отвечает");
    }
}

// ================= TASKS =================
async function loadTasks() {
    const list = document.getElementById('tasks-list');

    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);

        if (!res.ok) {
            throw new Error("Failed to load tasks");
        }

        const tasks = await res.json();
        list.innerHTML = '';

        tasks.forEach(task => {
            const div = document.createElement('div');
            div.className = 'card p-4 rounded-xl flex items-center justify-between shadow-sm';
            div.innerHTML = `
                <span class="${task.is_completed ? 'task-completed' : ''}">
                    ${task.title}
                </span>
                <input type="checkbox"
                    ${task.is_completed ? 'checked' : ''}
                    onclick="toggleTask(${task.id})">
            `;
            list.appendChild(div);
        });

    } catch (e) {
        console.error("Ошибка загрузки задач:", e);
        tg.showAlert("Не удалось загрузить задачи");
    }
}

async function addNewTask() {
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/add`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId, title })
        });

        if (!res.ok) {
            throw new Error("Failed to add task");
        }

        input.value = '';
        loadTasks();

    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка добавления задачи");
    }
}

async function toggleTask(taskId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, {
            method: 'POST'
        });

        if (!res.ok) {
            throw new Error("Toggle failed");
        }

        tg.HapticFeedback?.impactOccurred('light');
        loadTasks();

    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка изменения задачи");
    }
}

function showTasksScreen() {
    document.getElementById('reg-screen').classList.add('hidden');
    document.getElementById('tasks-screen').classList.remove('hidden');
    loadTasks();
}
