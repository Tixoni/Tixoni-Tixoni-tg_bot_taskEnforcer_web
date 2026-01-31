// API: тот же хост по умолчанию. Если открываете не с сервера — укажите <meta name="api-base" content="https://ваш-сервер.railway.app"> в index.html
const API_BASE_URL = (() => {
    const m = document.querySelector('meta[name="api-base"]');
    const url = m && m.getAttribute("content") && m.getAttribute("content").trim();
    return url || "";
})();

const tg = window.Telegram?.WebApp;

// Показать сообщение на странице. showAlert/showPopup в Web App 6.0 не поддерживаются — не вызываем их вообще
function showMessage(msg) {
    const errEl = document.getElementById("init-error");
    if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove("hidden");
        setTimeout(() => errEl.classList.add("hidden"), 5000);
    }
}

// Безопасное получение данных пользователя; режим без Telegram для теста
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
    if (tg) {
        tg.ready();
        showMessage("Данные Telegram не получены. Работа в тестовом режиме.");
    }
}

// Выполнить fetch с одним повтором при сетевой ошибке (холодный старт сервера)
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

// === Инициализация ===
(async function init() {
    try {
        const url = `${API_BASE_URL}/api/register`;
        const res = await fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `Ошибка сервера ${res.status}`);
        }

        await loadTasks();
        await loadHabits();
    } catch (e) {
        console.error("Initialization error:", e);
        const isNetwork = !e.message || e.message === "Failed to fetch" || (e.name === "TypeError" && e.message?.includes("fetch"));
        let msg;
        if (isNetwork) {
            msg = "Нет связи с сервером. Откройте приложение из меню бота (Web App). Проверьте интернет и что URL бота совпадает с сервером.";
        } else {
            try {
                const j = JSON.parse(e.message);
                msg = "Сервер: " + (j.detail || e.message);
            } catch (_) {
                msg = "Сервер: " + (e.message || "ошибка");
            }
        }
        showMessage(msg);
        const errEl = document.getElementById("init-error");
        if (errEl) errEl.classList.remove("hidden");
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
    
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
}

// Экранирование HTML для безопасного отображения заголовков
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Создание HTML для одной задачи или привычки (используется в loadTasks)
function createItemHTML(item, type) {
    const isTask = type === "task";
    const completed = isTask ? item.is_completed : item.is_completed_today;
    const borderClass = isTask ? "border-blue-600" : "border-orange-500";
    const toggleFn = isTask ? `toggleTask(${item.id})` : `toggleHabit(${item.id})`;
    const title = escapeHtml(item.title || "");
    return `
        <div class="card p-4 rounded-xl flex items-center justify-between shadow-sm mb-2 border-l-4 ${borderClass}">
            <span class="${completed ? "line-through opacity-50" : ""} font-bold">${title}</span>
            <input type="checkbox" ${completed ? "checked" : ""} onclick="${toggleFn}">
        </div>`;
}

// ================= TASKS =================

async function loadTasks() {
    const list = document.getElementById("tasks-list");
    if (!list) return;

    try {
        const [tRes, hRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tasks/${userId}`),
            fetch(`${API_BASE_URL}/api/habits/${userId}`)
        ]);

        if (!tRes.ok) throw new Error("Не удалось загрузить задачи");
        if (!hRes.ok) throw new Error("Не удалось загрузить привычки");

        const tasks = await tRes.json();
        const habits = await hRes.json();

        list.innerHTML = "";

        if (!Array.isArray(tasks)) throw new Error("Некорректный ответ API: задачи");
        if (!Array.isArray(habits)) throw new Error("Некорректный ответ API: привычки");

        tasks.forEach(t => list.insertAdjacentHTML("beforeend", createItemHTML(t, "task")));
        habits.forEach(h => list.insertAdjacentHTML("beforeend", createItemHTML(h, "habit")));
    } catch (e) {
        console.error("Load tasks error:", e);
        showMessage(e.message || "Ошибка загрузки данных");
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
        } else {
            const j = await res.json().catch(() => ({}));
            showMessage("Не удалось добавить задачу. " + (j.detail || res.status));
        }
        loadTasks();
    } catch (e) {
        showMessage("Нет связи. Проверьте интернет.");
    }
}

async function toggleTask(taskId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, { method: "POST" });
        if (res.ok) {
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
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
        if (!res.ok) throw new Error("Не удалось загрузить привычки");
        const habits = await res.json();
        list.innerHTML = "";

        if (!Array.isArray(habits)) throw new Error("Некорректный ответ API: привычки");

        habits.forEach(habit => {
            const div = document.createElement("div");
            div.className = "card p-4 rounded-xl flex items-center justify-between shadow-sm mb-2 border-l-4 border-orange-500";
            div.innerHTML = `
                <span class="${habit.is_completed_today ? "line-through opacity-50" : ""} font-bold">${escapeHtml(habit.title || "")}</span>
                <input type="checkbox" ${habit.is_completed_today ? "checked" : ""} 
                       onclick="toggleHabit(${habit.id})">
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.error("Load habits error:", e);
        showMessage(e.message || "Ошибка загрузки привычек");
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
        } else {
            const j = await res.json().catch(() => ({}));
            showMessage("Не удалось добавить привычку. " + (j.detail || res.status));
        }
        loadHabits();
    } catch (e) {
        showMessage("Нет связи. Проверьте интернет.");
    }
}

async function toggleHabit(habitId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/toggle/${habitId}`, { method: "POST" });
        if (res.ok) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
            loadHabits();
        }
    } catch (e) {
        console.error(e);
    }
}