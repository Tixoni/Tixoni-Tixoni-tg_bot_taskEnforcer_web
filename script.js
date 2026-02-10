const API_BASE_URL = document.querySelector('meta[name="api-base"]')?.getAttribute("content") || "";
const tg = window.Telegram?.WebApp;
let currentTab = 'today';
let userId = tg?.initDataUnsafe?.user?.id || 0; // В продакшене лучше проверять валидность
let userName = tg?.initDataUnsafe?.user?.username || "User";

let selectedItem = null; // { id, type, title }
let isSaving = false;
let calendarDate = new Date();
let selectedDate = new Date();

// === БЕЗОПАСНАЯ ФУНКЦИЯ СОЗДАНИЯ ЭЛЕМЕНТОВ ===
// Создает HTML элемент безопасным способом
function createSafeElement(tag, className, text = null) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text; // ЭТО ЗАЩИЩАЕТ ОТ XSS
    return el;
}

// Ждем загрузки DOM перед навешиванием событий
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function setupEventListeners() {
    // Навигация
    document.getElementById('btn-today').addEventListener('click', () => switchTab('today'));
    document.getElementById('btn-habits').addEventListener('click', () => switchTab('habits'));
    document.getElementById('btn-calendar').addEventListener('click', () => switchTab('calendar'));

    // Добавление задач/привычек
    document.getElementById('btn-add-task').addEventListener('click', addNewTask);
    document.getElementById('btn-add-habit').addEventListener('click', addNewHabit);

    // Модальные окна (закрытие по клику на фон)
    document.getElementById('context-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeContextModal();
    });
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
    });

    // Действия в модалках
    document.getElementById('btn-modal-cancel').addEventListener('click', closeContextModal);
    document.getElementById('btn-modal-delete').addEventListener('click', handleDelete);
    document.getElementById('btn-modal-edit').addEventListener('click', openEditModal);
    document.getElementById('btn-save-edit').addEventListener('click', handleUpdate);
}

async function initApp() {
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
    }
}

// === РЕНДЕРИНГ (Безопасный) ===

async function loadTasks() {
    const list = document.getElementById("list-active-tasks");
    if (!list) return;

    try {
        const [tRes, hRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tasks/${userId}`),
            fetch(`${API_BASE_URL}/api/habits/${userId}`)
        ]);

        const tasks = await tRes.json();
        const habits = await hRes.json();

        list.innerHTML = ''; // Очищаем контейнер

        // Рендерим привычки
        habits.forEach(habit => {
            const item = createItemElement(habit, 'habit');
            list.appendChild(item);
        });

        // Рендерим задачи
        tasks.forEach(task => {
            const item = createItemElement(task, 'task');
            list.appendChild(item);
        });

    } catch (e) { console.error(e); }
}

async function loadHabitsOnly() {
    const list = document.getElementById("list-habits-only");
    if (!list) return;
    
    const res = await fetch(`${API_BASE_URL}/api/habits/${userId}`);
    const habits = await res.json();
    
    list.innerHTML = '';
    habits.forEach(habit => {
        list.appendChild(createItemElement(habit, 'habit'));
    });
}

// ГЛАВНАЯ ФУНКЦИЯ СОЗДАНИЯ DOM-ЭЛЕМЕНТА ЗАДАЧИ/ПРИВЫЧКИ
function createItemElement(data, type) {
    const isHabit = type === 'habit';
    const isCompleted = isHabit ? data.is_completed_today : data.is_completed;
    
    // 1. Создаем контейнер
    const container = createSafeElement('div', `card ${isHabit ? 'habit-card' : ''}`);
    
    // Добавляем обработчик долгого нажатия (Long Press) для меню
    addLongPressHandler(container, data, type);

    // 2. Создаем чекбокс
    const checkbox = createSafeElement('input', isHabit ? 'checkbox-habit' : 'checkbox-task');
    checkbox.type = 'checkbox';
    checkbox.checked = isCompleted;
    
    // ВАЖНО: Добавляем событие через addEventListener
    checkbox.addEventListener('change', () => {
        if(isHabit) toggleHabit(data.id);
        else toggleTask(data.id);
    });

    // 3. Создаем текст (Безопасно через textContent)
    const textSpan = createSafeElement('span', 'flex-1 text-sm font-medium truncate', data.title);
    if (isCompleted) {
        textSpan.classList.add('line-through', 'text-muted');
    }

    // Собираем всё вместе
    container.appendChild(checkbox);
    container.appendChild(textSpan);
    
    return container;
}

// === ЛОГИКА ===

function switchTab(tab) {
    currentTab = tab;
    
    // Скрываем все, показываем нужное
    document.getElementById('screen-today').classList.toggle('hidden', tab !== 'today');
    document.getElementById('screen-habits').classList.toggle('hidden', tab !== 'habits');
    // ... логика для календаря ...

    // Обновляем классы кнопок
    document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active'));
    
    if(tab === 'today') {
        document.getElementById('btn-today').classList.add('active');
        loadTasks();
    } else if (tab === 'habits') {
        document.getElementById('btn-habits').classList.add('active');
        loadHabitsOnly();
    }
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
    refreshData();
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
    refreshData();
}

async function toggleTask(id) {
    await fetch(`${API_BASE_URL}/api/tasks/toggle/${id}`, { method: "POST" });
    if(tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
    refreshData();
}

async function toggleHabit(id) {
    await fetch(`${API_BASE_URL}/api/habits/toggle/${id}`, { method: "POST" });
    if(tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    refreshData();
}

function refreshData() {
    if (currentTab === 'today') loadTasks();
    if (currentTab === 'habits') loadHabitsOnly();
}

// === КОНТЕКСТНОЕ МЕНЮ (Long Press) ===
function addLongPressHandler(element, data, type) {
    let timer;
    
    const start = () => {
        timer = setTimeout(() => {
            if(tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("heavy");
            openContextModal(data.id, type, data.title);
        }, 500);
    };
    
    const end = () => clearTimeout(timer);

    element.addEventListener('touchstart', start);
    element.addEventListener('touchend', end);
    element.addEventListener('touchmove', end);
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', end);
}

function openContextModal(id, type, title) {
    selectedItem = { id, type, title };
    document.getElementById('context-modal').classList.remove('hidden');
}

function closeContextModal() {
    document.getElementById('context-modal').classList.add('hidden');
    selectedItem = null;
}

// === УДАЛЕНИЕ И РЕДАКТИРОВАНИЕ ===
async function handleDelete() {
    if (!selectedItem) return;
    const endpoint = selectedItem.type === 'habit' ? 'habits' : 'tasks';
    
    await fetch(`${API_BASE_URL}/api/${endpoint}/delete/${selectedItem.id}`, { method: "POST" });
    closeContextModal();
    refreshData();
}

function openEditModal() {
    closeContextModal(); // Закрываем маленькое меню
    const modal = document.getElementById('edit-modal');
    const input = document.getElementById('edit-input');
    
    input.value = selectedItem.title; // Безопасно, т.к. value не исполняет HTML
    modal.classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function handleUpdate() {
    if (!selectedItem) return;
    const input = document.getElementById('edit-input');
    const newTitle = input.value.trim();
    if (!newTitle) return;

    const endpoint = selectedItem.type === 'habit' ? 'habits' : 'tasks';
    
    await fetch(`${API_BASE_URL}/api/${endpoint}/update/${selectedItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle })
    });
    
    closeEditModal();
    refreshData();
}