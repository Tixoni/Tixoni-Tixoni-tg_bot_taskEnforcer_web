const API_BASE_URL = (() => {
    const m = document.querySelector('meta[name="api-base"]');
    return (m && m.getAttribute("content")) || "";
})();

const tg = window.Telegram?.WebApp;
let currentTab = 'today';
let userId = tg?.initDataUnsafe?.user?.id || 0;
let userName = tg?.initDataUnsafe?.user?.username || "User";

let pressTimer;
let selectedItem = null; // { id, type, title }
let isSaving = false;
let calendarDate = new Date(); // Месяц, который смотрим
let selectedDate = new Date(); // Конкретный день

(async function init() {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor('#000000');
    try {
        await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tg_id: userId, name: userName })
        });
        refreshData();
    } catch (e) { showMessage("Ошибка подключения"); }
})();

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('screen-today').classList.toggle('hidden', tab !== 'today');
    document.getElementById('screen-habits').classList.toggle('hidden', tab !== 'habits');
    document.getElementById('screen-calendar').classList.toggle('hidden', tab !== 'calendar');

    document.getElementById('btn-today').classList.toggle('active', tab === 'today');
    document.getElementById('btn-habits').classList.toggle('active', tab === 'habits');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tab}`).classList.add('active');
    
    if (tab === 'calendar') renderCalendar();
    if (tab === 'today') refreshData();
    refreshData();
}

async function refreshData() {
    try {
        const [tRes, hRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tasks/${userId}`),
            fetch(`${API_BASE_URL}/api/habits/${userId}`)
        ]);
        renderLists(await tRes.json(), await hRes.json());
    } catch (e) { console.error(e); }
}

function renderLists(tasks, habits) {
    const active = tasks.filter(t => !t.is_completed);
    const done = tasks.filter(t => t.is_completed);

    document.getElementById('list-active-tasks').innerHTML = active.map(t => createItemHTML(t, 'task')).join('');
    document.getElementById('list-today-habits').innerHTML = habits.map(h => createItemHTML(h, 'habit')).join('');
    document.getElementById('list-completed-tasks').innerHTML = done.map(t => createItemHTML(t, 'task')).join('');
    
    const hFull = document.getElementById('list-all-habits');
    if (hFull) hFull.innerHTML = habits.map(h => createItemHTML(h, 'habit')).join('');
}

function createItemElement(item, type) {
    const isDone = type === 'task' ? item.is_completed : (item.is_completed_today || item.is_complete_today);
    const checkCls = type === 'task' ? 'checkbox-task' : 'checkbox-habit';
    
    const card = document.createElement('div');
    card.className = 'card';

    const startHandler = (e) => handlePressStart(e, item.id, type, item.title);
    
    card.addEventListener('touchstart', startHandler);
    card.addEventListener('mousedown', startHandler);
    card.addEventListener('touchend', handlePressEnd);
    card.addEventListener('mouseup', handlePressEnd);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = checkCls;
    checkbox.checked = !!isDone;
    
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        type === 'task' ? toggleTask(item.id) : toggleHabit(item.id);
    });

    const span = document.createElement('span');
    span.textContent = item.title; 
    
    const statusClasses = isDone 
        ? 'line-through opacity-40 text-gray-500' 
        : 'font-semibold text-gray-100';
    span.className = `flex-1 ${statusClasses}`;

    card.appendChild(checkbox);
    card.appendChild(span);

    return card;
}

// LONG PRESS LOGIC
function handlePressStart(e, id, type, title) {
    if (e.target.tagName === 'INPUT') return;
    pressTimer = window.setTimeout(() => {
        selectedItem = { id, type, title };
        openContextModal();
    }, 600);
}

function handlePressEnd() { clearTimeout(pressTimer); }

function openContextModal() {
    document.getElementById('context-modal').style.display = 'flex';
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
}

function closeContextModal() { document.getElementById('context-modal').style.display = 'none'; }

function openEditModal() {
    closeContextModal();
    const input = document.getElementById('edit-input');
    input.value = selectedItem.title;
    document.getElementById('edit-modal').style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}

function closeEditModal() { document.getElementById('edit-modal').style.display = 'none'; }

async function handleUpdate() {
    const val = document.getElementById('edit-input').value.trim();
    if (!val || !selectedItem) return;
    const path = selectedItem.type === 'task' ? `/api/tasks/update/${selectedItem.id}` : `/api/habits/update/${selectedItem.id}`;
    await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: val })
    });
    closeEditModal();
    refreshData();
}

async function confirmDelete() {
    if (!selectedItem) return;
    const path = selectedItem.type === 'task' ? `/api/tasks/${selectedItem.id}` : `/api/habits/${selectedItem.id}`;
    await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
    closeContextModal();
    refreshData();
}

// ... остальной код (openModal, handleSave, toggleTask...) без изменений
function openModal() {
    const m = document.getElementById('input-modal');
    document.getElementById('modal-title').innerText = currentTab === 'today' ? "Новая задача" : "Новая привычка";
    m.style.display = 'flex';
    setTimeout(() => document.getElementById('main-input').focus(), 100);
}

function closeModal() {
    document.getElementById('input-modal').style.display = 'none';
    document.getElementById('main-input').value = '';
}

async function handleSave() {
    const val = document.getElementById('main-input').value.trim();
    if (!val || isSaving) return;
    isSaving = true;

    // ИСПРАВЛЕНИЕ: Проверяем, что вкладка либо 'today', либо 'calendar'
    const isTask = (currentTab === 'today' || currentTab === 'calendar');
    
    
    // Определяем дату
    const taskDate = (currentTab === 'calendar') 
        ? selectedDate.toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];


    const body = { 
        user_id: userId, 
        title: val,
        date: taskDate // Эта дата должна уйти на сервер
    };

    const path = isTask ? '/api/tasks/add' : '/api/habits/add';

    try {
        await fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        closeModal();
        refreshData();
    } catch (e) {
        console.error("Ошибка сохранения:", e);
    } finally { 
        isSaving = false; 
    }
}

async function toggleTask(id) {
    await fetch(`${API_BASE_URL}/api/tasks/toggle/${id}`, { method: "POST" });
    tg?.HapticFeedback?.impactOccurred("light");
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


// --- ЛОГИКА КАЛЕНДАРЯ ---

function renderCalendar() {
    const grid = document.getElementById('calendar-grid-days');
    const title = document.getElementById('calendar-month-title');
    grid.innerHTML = '';
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    // Название месяца
    title.innerText = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(calendarDate);

    const firstDay = new Date(year, month, 1).getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Заглушки для пустых дней в начале
    for (let i = 1; i < firstDay; i++) {
        grid.innerHTML += `<div class="aspect-square"></div>`;
    }

    // Рендерим числа
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
        const activeClass = isToday ? 'border border-orange-500 text-orange-500' : 'text-white bg-zinc-900';
        
        grid.innerHTML += `
            <div onclick="selectDay(${d})" class="aspect-square flex items-center justify-center rounded-xl text-sm font-bold active:scale-90 transition ${activeClass}">
                ${d}
            </div>
        `;
    }
}

function selectDay(day) {
    selectedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    document.getElementById('calendar-month-view').classList.add('hidden');
    document.getElementById('calendar-week-view').classList.remove('hidden');
    renderWeekView();
}

function backToMonth() {
    document.getElementById('calendar-month-view').classList.remove('hidden');
    document.getElementById('calendar-week-view').classList.add('hidden');
}

function renderWeekView() {
    const strip = document.getElementById('week-strip');
    strip.innerHTML = '';
    
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - (selectedDate.getDay() || 7) + 1);

    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const isActive = d.toDateString() === selectedDate.toDateString();
        
        strip.innerHTML += `
            <div onclick="setSpecificDay('${d.toISOString()}')" class="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${isActive ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-500'}">
                <span class="text-[9px] uppercase font-black">${['пн','вт','ср','чт','пт','сб','вс'][i]}</span>
                <span class="text-sm font-bold">${d.getDate()}</span>
            </div>
        `;
    }
    fetchCalendarTasks();
}

async function setSpecificDay(dateStr) {
    selectedDate = new Date(dateStr);
    renderWeekView();
}

async function fetchCalendarTasks() {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const res = await fetch(`${API_BASE_URL}/api/tasks/${userId}?date=${dateStr}`);
    const tasks = await res.json();
    const container = document.getElementById('list-calendar-tasks');
    
    container.innerHTML = tasks.length ? '' : '<div class="p-8 text-center text-zinc-600 text-xs uppercase tracking-widest font-bold">Задач нет</div>';
    tasks.forEach(t => {
        container.innerHTML += `
            <div class="card border-b border-zinc-800/50 last:border-none">
                <input type="checkbox" ${t.is_completed ? 'checked' : ''} onclick="toggleTask(${t.id})" class="checkbox-task">
                <span class="${t.is_completed ? 'line-through text-zinc-600' : 'text-white'} text-sm">${t.title}</span>
            </div>
        `;
    });
}

function changeCalendarPeriod(offset) {
    calendarDate.setMonth(calendarDate.getMonth() + offset);
    renderCalendar();
}

function setCalendarToToday() {
    calendarDate = new Date();
    selectedDate = new Date();
    renderCalendar();
    if (!document.getElementById('calendar-week-view').classList.contains('hidden')) {
        renderWeekView();
    }
}
