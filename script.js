const API_BASE_URL = (() => {
    const m = document.querySelector('meta[name="api-base"]');
    return (m && m.getAttribute("content")) || "";
})();

const tg = window.Telegram?.WebApp;
let currentTab = 'today';
let userId = tg?.initDataUnsafe?.user?.id || 0;
let userName = tg?.initDataUnsafe?.user?.username || "User";

// Инициализация
(async function init() {
    tg?.ready();
    tg?.expand();
    try {
        await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });
        refreshData();
    } catch (e) {
        console.error(e);
        showMessage("Ошибка подключения");
    }
})();

// Переключение вкладок
function switchTab(tab) {
    currentTab = tab;
    
    // Переключение экранов
    document.getElementById('screen-today').classList.toggle('hidden', tab !== 'today');
    document.getElementById('screen-habits').classList.toggle('hidden', tab !== 'habits');
    
    // Подсветка кнопок
    document.getElementById('btn-today').classList.toggle('active', tab === 'today');
    document.getElementById('btn-habits').classList.toggle('active', tab === 'habits');
    
    refreshData();
}

// Загрузка и отрисовка данных
async function refreshData() {
    try {
        const [tRes, hRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tasks/${userId}`),
            fetch(`${API_BASE_URL}/api/habits/${userId}`)
        ]);
        
        const tasks = await tRes.json();
        const habits = await hRes.json();
        
        renderLists(tasks, habits);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

function renderLists(tasks, habits) {
    // Распределение задач
    const activeTasks = tasks.filter(t => !t.is_completed);
    const completedTasks = tasks.filter(t => t.is_completed);

    // 1. Секция активных задач на "Сегодня"
    document.getElementById('list-active-tasks').innerHTML = 
        activeTasks.map(t => createItemHTML(t, 'task')).join('');

    // 2. Секция привычек на "Сегодня"
    document.getElementById('list-today-habits').innerHTML = 
        habits.map(h => createItemHTML(h, 'habit')).join('');

    // 3. Секция выполненных задач на "Сегодня"
    document.getElementById('list-completed-tasks').innerHTML = 
        completedTasks.map(t => createItemHTML(t, 'task')).join('');

    // 4. Полный список привычек на вкладке "Привычки"
    const habitsListFull = document.getElementById('list-all-habits');
    if (habitsListFull) {
        habitsListFull.innerHTML = habits.map(h => createItemHTML(h, 'habit')).join('');
    }
}

function createItemHTML(item, type) {
    const isDone = type === 'task'
        ? item.is_completed
        : (item.is_completed_today === true || item.is_complete_today === true);
    const borderClass = type === 'task' ? 'task-border' : 'habit-border';
    const clickFn = type === 'task' ? `toggleTask(${item.id})` : `toggleHabit(${item.id})`;
    const checkboxClass = type === 'task' ? 'checkbox-task' : 'checkbox-habit';

    return `
        <div class="card p-4 rounded-2xl flex items-center gap-3 shadow-sm ${borderClass}">
            <input type="checkbox" class="${checkboxClass}" ${isDone ? 'checked' : ''} onclick="${clickFn}">
            <span class="flex-1 ${isDone ? 'line-through opacity-60 text-gray-500' : 'font-semibold'}">${escapeHtml(item.title)}</span>
        </div>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Управление модальным окном
function openModal() {
    const modal = document.getElementById('input-modal');
    const input = document.getElementById('main-input');
    const title = document.getElementById('modal-title');
    
    // Контекстный заголовок
    if (currentTab === 'today') {
        title.innerText = "Новая задача";
        input.placeholder = "Что нужно сделать?";
    } else {
        title.innerText = "Новая привычка";
        input.placeholder = "Например: Пить воду";
    }
    
    modal.style.display = 'flex';
    
    // Автофокус для немедленного ввода
    setTimeout(() => input.focus(), 50);
}

function closeModal() {
    document.getElementById('input-modal').style.display = 'none';
    document.getElementById('main-input').value = '';
}

async function handleSave() {
    const val = document.getElementById('main-input').value.trim();
    if (!val) return;

    const endpoint = currentTab === 'today' ? '/api/tasks/add' : '/api/habits/add';
    
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title: val })
        });
        
        if (res.ok) {
            closeModal();
            refreshData();
        }
    } catch (e) {
        showMessage("Ошибка сохранения");
    }
}

// Переключение статусов (API)
async function toggleTask(id) {
    await fetch(`${API_BASE_URL}/api/tasks/toggle/${id}`, { method: "POST" });
    tg?.HapticFeedback?.impactOccurred("medium");
    refreshData();
}

async function toggleHabit(id) {
    await fetch(`${API_BASE_URL}/api/habits/toggle/${id}`, { method: "POST" });
    tg?.HapticFeedback?.notificationOccurred("success");
    refreshData();
}

function showMessage(msg) {
    const err = document.getElementById('init-error');
    err.innerText = msg;
    err.classList.remove('hidden');
    setTimeout(() => err.classList.add('hidden'), 3000);
}