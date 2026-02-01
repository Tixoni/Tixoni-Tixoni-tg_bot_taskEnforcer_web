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
    document.getElementById('btn-today').classList.toggle('active', tab === 'today');
    document.getElementById('btn-habits').classList.toggle('active', tab === 'habits');
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

function createItemHTML(item, type) {
    const isDone = type === 'task' ? item.is_completed : (item.is_completed_today || item.is_complete_today);
    const checkCls = type === 'task' ? 'checkbox-task' : 'checkbox-habit';
    const clickFn = type === 'task' ? `toggleTask(${item.id})` : `toggleHabit(${item.id})`;

    return `
        <div class="card" 
             ontouchstart="handlePressStart(event, ${item.id}, '${type}', '${item.title.replace(/'/g, "\\'")}')" 
             ontouchend="handlePressEnd()" 
             onmousedown="handlePressStart(event, ${item.id}, '${type}', '${item.title.replace(/'/g, "\\'")}')" 
             onmouseup="handlePressEnd()">
            <input type="checkbox" class="${checkCls}" ${isDone ? 'checked' : ''} onclick="${clickFn}; event.stopPropagation();">
            <span class="flex-1 ${isDone ? 'line-through opacity-40 text-gray-500' : 'font-semibold text-gray-100'}">${item.title}</span>
        </div>`;
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
    const path = currentTab === 'today' ? '/api/tasks/add' : '/api/habits/add';
    try {
        await fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, title: val })
        });
        closeModal();
        refreshData();
    } finally { isSaving = false; }
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