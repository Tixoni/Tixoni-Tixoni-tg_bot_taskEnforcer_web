const API_BASE_URL = "https://tgbottaskenforcer-production.up.railway.app"; 
const tg = window.Telegram.WebApp;

// 1. Критическое исправление: Безопасное получение данных пользователя 
const tgUser = tg.initDataUnsafe?.user;

if (!tgUser?.id) {
    tg.ready();
    tg.showAlert("Ошибка: Данные Telegram не получены. Попробуйте перезапустить бота.");
    throw new Error("No Telegram user data available");
}

const userId = tgUser.id;
const userName = tgUser.username || tgUser.first_name || "User";

tg.ready();
tg.expand();

// === Инициализация ===
(async function init() {
    try {
        // 2. Критическое исправление: Проверка успешности регистрации 
        const res = await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Registration failed: ${errorText}`);
        }

        // Загружаем данные только после успешной проверки пользователя
        await Promise.all([loadTasks(), loadHabits()]);

    } catch (e) {
        console.error("Initialization error:", e);
        tg.showAlert("Сервер недоступен. Проверьте соединение.");
    }
})();

// === Навигация ===
function switchTab(tab) {
    const tasksScreen = document.getElementById('tasks-screen');
    const habitsScreen = document.getElementById('habits-screen');
    const btnTasks = document.getElementById('btn-tasks');
    const btnHabits = document.getElementById('btn-habits');

    if (!tasksScreen || !habitsScreen) return; // Защита от ошибок DOM

    if (tab === 'tasks') {
        tasksScreen.classList.remove('hidden');
        habitsScreen.classList.add('hidden');
        btnTasks.classList.add('active');
        btnHabits.classList.remove('active');
        loadTasks();
    } else {
        tasksScreen.classList.add('hidden');
        habitsScreen.classList.remove('hidden');
        btnTasks.classList.remove('active');
        btnHabits.classList.add('active');
        loadHabits();
    }
    
    // 3. Исправление: Чистый JS без цитат 
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
}

// ================= TASKS =================

async function loadTasks() {
    const list = document.getElementById("tasks-list");
    if (!list) return;

    try {
        // Вызываем два метода одновременно
        const [tRes, hRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tasks/${userId}`),
            fetch(`${API_BASE_URL}/api/habits/${userId}`)
        ]);

        const tasks = await tRes.json();
        const habits = await hRes.json();

        list.innerHTML = "";

        // Рендерим обычные задачи
        tasks.forEach(t => list.insertAdjacentHTML('beforeend', createItemHTML(t, 'task')));

        // Рендерим привычки 
        habits.forEach(h => list.insertAdjacentHTML('beforeend', createItemHTML(h, 'habit')));
        

    } catch (e) { console.error("Load tasks error:", e); }
}

async function addNewTask() {
    const input = document.getElementById("task-input");
    const title = input.value.trim();
    if (!title) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title: title })
        });
        if (res.ok) {
            input.value = "";
            loadTasks();
        }
    } catch (e) {
        tg.showAlert("Не удалось добавить задачу");
    }
}

async function toggleTask(taskId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, { method: "POST" });
        if (res.ok) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
            loadTasks();
        }
    } catch (e) {
        console.error(e);
    }
}

// ================= HABITS =================

async function loadHabits() {
    const list = document.getElementById("habits-list");
    if (!list) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/${userId}`);
        if (!res.ok) throw new Error("Load habits failed");
        
        const habits = await res.json();
        list.innerHTML = "";

        habits.forEach(habit => {
            const div = document.createElement("div");
            div.className = "card p-4 rounded-xl flex items-center justify-between shadow-sm mb-2 border-l-4 border-orange-500";
            div.innerHTML = `
                <span class="${habit.is_completed_today ? "line-through opacity-50" : ""} font-bold">${habit.title}</span>
                <input type="checkbox" ${habit.is_completed_today ? "checked" : ""} 
                       onclick="toggleHabit(${habit.id})">
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.error(e);
    }
}

async function addNewHabit() {
    const input = document.getElementById("habit-input");
    const title = input.value.trim();
    if (!title) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title: title })
        });
        if (res.ok) {
            input.value = "";
            loadHabits();
        }
    } catch (e) {
        tg.showAlert("Не удалось добавить привычку");
    }
}

async function toggleHabit(habitId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/toggle/${habitId}`, { method: "POST" });
        if (res.ok) {
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
            loadHabits();
        }
    } catch (e) {
        console.error(e);
    }
}