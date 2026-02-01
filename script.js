const API_BASE_URL = (() => {
    const m = document.querySelector('meta[name="api-base"]');
    const url = m && m.getAttribute("content") && m.getAttribute("content").trim();
    return url || "";
})();

const tg = window.Telegram?.WebApp;

function showMessage(msg) {
    const errEl = document.getElementById("init-error");
    if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove("hidden");
        setTimeout(() => errEl.classList.add("hidden"), 5000);
    }
}

let userId, userName;
if (tg?.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    userId = u.id;
    userName = u.username || u.first_name || "User";
    tg.ready();
    tg.expand();
} else {
    userId = 0;
    userName = "TestUser";
    if (tg) tg.ready();
}

async function fetchWithRetry(url, options, retries = 1) {
    try {
        return await fetch(url, options);
    } catch (e) {
        if (retries > 0 && (e.name === "TypeError" || e.message?.includes("fetch"))) {
            await new Promise(r => setTimeout(r, 2500));
            return fetch(url, options);
        }
        throw e;
    }
}

// Инициализация при загрузке
(async function init() {
    try {
        const url = `${API_BASE_URL}/api/register`;
        await fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });
        
        // Загружаем оба списка параллельно
        await Promise.all([loadTasks(), loadHabits()]);
    } catch (e) {
        console.error("Initialization error:", e);
        showMessage("Ошибка подключения к серверу.");
    }
})();

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Универсальная функция создания HTML для элемента
 * @param {Object} item - объект задачи или привычки
 * @param {string} type - 'task' или 'habit'
 */
function createItemHTML(item, type) {
    const isCompleted = type === 'task' ? item.is_completed : item.is_complete_today;
    const borderClass = type === 'task' ? 'border-blue-600' : 'border-orange-500 habit-card';
    const clickFn = type === 'task' ? `toggleTask(${item.id})` : `toggleHabit(${item.id})`;
    const title = escapeHtml(item.title || "");

    return `
        <div class="card p-4 rounded-xl flex items-center justify-between shadow-sm mb-2 border-l-4 ${borderClass} bg-white">
            <span class="${isCompleted ? "line-through opacity-50 text-gray-400" : "font-bold text-gray-800"}">${title}</span>
            <input type="checkbox" ${isCompleted ? "checked" : ""} onclick="${clickFn}" class="w-5 h-5 cursor-pointer">
        </div>`;
}

// ================= ЛОГИКА ЗАДАЧ =================

async function loadTasks() {
    const list = document.getElementById("tasks-list");
    if (!list) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);
        if (!res.ok) throw new Error("Ошибка загрузки задач");
        const tasks = await res.json();
        list.innerHTML = "";
        tasks.forEach(t => list.insertAdjacentHTML("beforeend", createItemHTML(t, 'task')));
    } catch (e) {
        showMessage(e.message);
    }
}

async function addNewTask() {
    const input = document.getElementById("task-input");
    const title = input.value.trim();
    if (!title) return;
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/tasks/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title: title })
        });
        if (res.ok) {
            input.value = "";
            loadTasks();
        }
    } catch (e) {
        showMessage("Не удалось добавить задачу.");
    }
}

async function toggleTask(taskId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, { method: "POST" });
        if (res.ok) {
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
            loadTasks();
        }
    } catch (e) { console.error(e); }
}

// ================= ЛОГИКА ПРИВЫЧЕК =================

async function loadHabits() {
    const list = document.getElementById("habits-list");
    if (!list) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/${userId}`);
        if (!res.ok) throw new Error("Ошибка загрузки привычек");
        const habits = await res.json();
        list.innerHTML = "";
        habits.forEach(h => list.insertAdjacentHTML("beforeend", createItemHTML(h, 'habit')));
    } catch (e) {
        showMessage(e.message);
    }
}

async function addNewHabit() {
    const input = document.getElementById("habit-input");
    const title = input.value.trim();
    if (!title) return;
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/habits/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title: title })
        });
        if (res.ok) {
            input.value = "";
            loadHabits();
        }
    } catch (e) {
        showMessage("Не удалось добавить привычку.");
    }
}

async function toggleHabit(habitId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/toggle/${habitId}`, { method: "POST" });
        if (res.ok) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
            loadHabits();
        }
    } catch (e) { console.error(e); }
}