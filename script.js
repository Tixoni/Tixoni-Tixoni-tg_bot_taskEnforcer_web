const API_BASE_URL = "https://tgbottaskenforcer-production.up.railway.app";

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const tgUser = tg.initDataUnsafe.user;

if (!tgUser?.id) {
    tg.showAlert("Не удалось получить данные Telegram");
    throw new Error("No Telegram user");
}

const userId = tgUser.id;
const userName =
    tgUser.username ||
    tgUser.first_name ||
    "TelegramUser";

// === АВТО-РЕГИСТРАЦИЯ ===
(async function init() {
    try {
        await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tg_id: userId,
                name: userName
            })
        });

        showTasksScreen();

    } catch (e) {
        console.error(e);
        tg.showAlert("Не удалось подключиться к серверу");
    }
})();

// ================= TASKS =================
async function loadTasks() {
    const list = document.getElementById("tasks-list");

    try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}`);
        if (!res.ok) throw new Error("Load failed");

        const tasks = await res.json();
        list.innerHTML = "";

        tasks.forEach(task => {
            const div = document.createElement("div");
            div.className =
                "card p-4 rounded-xl flex items-center justify-between shadow-sm";

            div.innerHTML = `
                <span class="${task.is_completed ? "task-completed" : ""}">
                    ${task.title}
                </span>
                <input type="checkbox"
                    ${task.is_completed ? "checked" : ""}
                    onclick="toggleTask(${task.id})">
            `;

            list.appendChild(div);
        });

    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка загрузки задач");
    }
}

async function addNewTask() {
    const input = document.getElementById("task-input");
    const title = input.value.trim();
    if (!title) return;

    try {
        await fetch(`${API_BASE_URL}/api/tasks/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title })
        });

        input.value = "";
        loadTasks();

    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка добавления задачи");
    }
}

async function toggleTask(taskId) {
    try {
        await fetch(`${API_BASE_URL}/api/tasks/toggle/${taskId}`, {
            method: "POST"
        });

        tg.HapticFeedback?.impactOccurred("light");
        loadTasks();

    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка изменения задачи");
    }
}

function showTasksScreen() {
    document.getElementById("tasks-screen").classList.remove("hidden");
    loadTasks();
}
