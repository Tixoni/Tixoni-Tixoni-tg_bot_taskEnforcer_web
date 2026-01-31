const API_BASE_URL = "https://tgbottaskenforcer-production.up.railway.app"; 
const tg = window.Telegram.WebApp;
const userId = tg.initDataUnsafe.user?.id || 12345; // Для тестов
const userName = tg.initDataUnsafe.user?.first_name || "User";

tg.ready();
tg.expand();

// === Инициализация ===
(async function init() {
    try {
        await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });
        loadTasks();
        loadHabits();
    } catch (e) {
        console.error("Auth error:", e);
    }
})();

// === Переключение вкладок ===
function switchTab(tab) {
    document.getElementById('tasks-screen').classList.toggle('hidden', tab !== 'tasks');
    document.getElementById('habits-screen').classList.toggle('hidden', tab !== 'habits');
    
    document.getElementById('btn-tasks').classList.toggle('active', tab === 'tasks');
    document.getElementById('btn-habits').classList.toggle('active', tab === 'habits');
    
    tg.HapticFeedback.impactOccurred("light");
}

// === Работа с задачами ===
async function loadTasks() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);
        const tasks = await res.json();
        const list = document.getElementById("tasks-list");
        list.innerHTML = "";
        tasks.forEach(task => {
            const div = document.createElement("div");
            div.className = "card p-4 rounded-xl flex items-center justify-between shadow-sm";
            div.innerHTML = `
                <span class="${task.is_completed ? "task-completed" : ""}">${task.title}</span>
                <input type="checkbox" ${task.is_completed ? "checked" : ""} onclick="toggleTask(${task.id})">
            `;
            list.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function addNewTask() {
    const input = document.getElementById("task-input");
    const title = input.value.trim();
    if (!title) return;
    await fetch(`${API_BASE_URL}/api/tasks/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, title })
    });
    input.value = "";
    loadTasks();
}

async function toggleTask(taskId) {
    await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, { method: "POST" });
    loadTasks();
}

// === Работа с привычками === 
async function loadHabits() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/${userId}`);
        const habits = await res.json();
        const list = document.getElementById("habits-list");
        list.innerHTML = "";
        habits.forEach(habit => {
            const div = document.createElement("div");
            div.className = "card habit-card p-4 rounded-xl flex items-center justify-between shadow-sm";
            div.innerHTML = `
                <span>${habit.title}</span>
                <input type="checkbox" ${habit.is_completed_today ? "checked" : ""} onclick="toggleHabit(${habit.id})">
            `;
            list.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function addNewHabit() {
    const input = document.getElementById("habit-input");
    const title = input.value.trim();
    if (!title) return;
    await fetch(`${API_BASE_URL}/api/habits/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, title })
    });
    input.value = "";
    loadHabits();
}

async function toggleHabit(habitId) {
    await fetch(`${API_BASE_URL}/api/habits/toggle/${habitId}`, { method: "POST" });
    loadHabits();
}