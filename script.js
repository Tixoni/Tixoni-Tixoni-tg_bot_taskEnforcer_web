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

(async function init() {
    try {
        const url = `${API_BASE_URL}/api/register`;
        await fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });
        await loadTasks();
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

function createItemHTML(item) {
    const completed = item.is_completed;
    const title = escapeHtml(item.title || "");
    return `
        <div class="card p-4 rounded-xl flex items-center justify-between shadow-sm mb-2 border-l-4 border-blue-600 bg-white">
            <span class="${completed ? "line-through opacity-50" : ""} font-bold">${title}</span>
            <input type="checkbox" ${completed ? "checked" : ""} onclick="toggleTask(${item.id})">
        </div>`;
}

async function loadTasks() {
    const list = document.getElementById("tasks-list");
    if (!list) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);
        if (!res.ok) throw new Error("Не удалось загрузить задачи");
        const tasks = await res.json();
        list.innerHTML = "";
        if (!Array.isArray(tasks)) throw new Error("Некорректный ответ API");
        tasks.forEach(t => list.insertAdjacentHTML("beforeend", createItemHTML(t)));
    } catch (e) {
        showMessage(e.message || "Ошибка загрузки");
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
        showMessage("Нет связи.");
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