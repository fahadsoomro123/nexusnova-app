import { loadJson, saveJson } from '../../core/local-store.js';

const ACTIVE_HTML_CLASS = 'nx-todo-v1-active';
const SCREEN_CLASS = 'nx-todo-v1-screen';
const TODO_KEY = 'nexus_todos_v1';
const EDIT_STYLE_ID = 'nx-todo-edit-v1-css';

const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalThemeColor = themeMeta?.content || '#07111f';
const originalColorScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

function ensureTodoEditStyles() {
  if (document.getElementById(EDIT_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = EDIT_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = './assets/styles/todo-edit-v1.css?ota=todo-edit-v1';
  document.head.appendChild(link);
}

function applyTodoTheme() {
  if (!activeScreen) return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxTodoTheme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f5f7fb' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreThemeMeta() {
  delete document.documentElement.dataset.nxTodoTheme;
  if (themeMeta) themeMeta.content = originalThemeColor;
  if (schemeMeta) schemeMeta.content = originalColorScheme;
}

function todoScreenFromStage() {
  const todoRoot = stage?.querySelector('.nx-todo-pro');
  if (!todoRoot) return null;
  const screen = todoRoot.closest('.nx-screen');
  if (!screen) return null;
  return { screen, todoRoot };
}

function installTodoEditing(todoRoot) {
  ensureTodoEditStyles();
  const input = todoRoot.querySelector('[data-todo-input]');
  const priority = todoRoot.querySelector('[data-todo-priority]');
  const due = todoRoot.querySelector('[data-todo-due]');
  const addButton = todoRoot.querySelector('[data-add-todo]');
  const list = todoRoot.querySelector('[data-todo-list]');
  if (!input || !priority || !due || !addButton || !list) return () => {};

  let editingId = '';

  const readTodos = () => {
    const value = loadJson(TODO_KEY, []);
    return Array.isArray(value) ? value : [];
  };

  const refreshList = () => {
    queueMicrotask(() => {
      const activeFilter = todoRoot.querySelector('[data-filter].is-active') || todoRoot.querySelector('[data-filter]');
      activeFilter?.click();
    });
  };

  const leaveEditMode = ({ clear = false } = {}) => {
    editingId = '';
    delete todoRoot.dataset.editingTask;
    addButton.textContent = 'ADD TASK';
    addButton.classList.remove('is-editing');
    if (clear) {
      input.value = '';
      due.value = '';
      priority.value = 'normal';
    }
  };

  const editTask = id => {
    const task = readTodos().find(item => item?.id === id);
    if (!task) return;
    editingId = id;
    todoRoot.dataset.editingTask = id;
    input.value = String(task.text || '');
    priority.value = ['high', 'normal', 'low'].includes(task.priority) ? task.priority : 'normal';
    due.value = String(task.due || '');
    addButton.textContent = 'UPDATE TASK';
    addButton.classList.add('is-editing');
    input.focus({ preventScroll:true });
    input.setSelectionRange?.(input.value.length, input.value.length);
  };

  const injectEditButtons = () => {
    if (editingId && !readTodos().some(item => item?.id === editingId)) leaveEditMode({ clear:true });
    list.querySelectorAll('.nx-todo-card').forEach(card => {
      if (card.querySelector('[data-todo-edit-v1]')) return;
      const deleteButton = card.querySelector('[data-delete-todo]');
      const id = String(deleteButton?.dataset.deleteTodo || '');
      if (!deleteButton || !id) return;
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'nx-todo-edit';
      editButton.dataset.todoEditV1 = id;
      editButton.setAttribute('aria-label', 'Edit task');
      editButton.textContent = '✎';
      editButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        editTask(id);
      });
      deleteButton.insertAdjacentElement('beforebegin', editButton);
    });
  };

  const handleUpdate = event => {
    if (!editingId) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const text = input.value.trim();
    if (!text) {
      input.focus({ preventScroll:true });
      return;
    }

    const todos = readTodos();
    const task = todos.find(item => item?.id === editingId);
    if (!task) {
      leaveEditMode({ clear:true });
      refreshList();
      return;
    }

    task.text = text;
    task.priority = ['high', 'normal', 'low'].includes(priority.value) ? priority.value : 'normal';
    task.due = due.value || '';
    task.updatedAt = new Date().toISOString();

    if (!saveJson(TODO_KEY, todos)) return;
    leaveEditMode({ clear:true });
    refreshList();
  };

  const handleInputKeydown = event => {
    if (!editingId) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      addButton.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      leaveEditMode({ clear:true });
      input.blur();
    }
  };

  addButton.addEventListener('click', handleUpdate, true);
  input.addEventListener('keydown', handleInputKeydown, true);

  const listObserver = new MutationObserver(() => queueMicrotask(injectEditButtons));
  listObserver.observe(list, { childList:true, subtree:true });
  injectEditButtons();

  return () => {
    listObserver.disconnect();
    addButton.removeEventListener('click', handleUpdate, true);
    input.removeEventListener('keydown', handleInputKeydown, true);
    leaveEditMode();
  };
}

function enhanceTodo(screen, todoRoot) {
  if (screen.dataset.todoV1Enhanced === '1') return () => {};

  screen.dataset.todoV1Enhanced = '1';
  screen.classList.add(SCREEN_CLASS);
  document.documentElement.classList.add(ACTIVE_HTML_CLASS);
  document.body.classList.add(ACTIVE_HTML_CLASS);
  activeScreen = screen;
  applyTodoTheme();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-todo-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);

  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const removeEditing = installTodoEditing(todoRoot);
  const themeListener = () => applyTodoTheme();
  lightQuery?.addEventListener?.('change', themeListener);

  return () => {
    removeEditing();
    lightQuery?.removeEventListener?.('change', themeListener);
    back.remove();
    screen.classList.remove(SCREEN_CLASS);
    delete screen.dataset.todoV1Enhanced;
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    activeScreen = null;
    restoreThemeMeta();
  };
}

function syncTodoEnhancement() {
  const found = todoScreenFromStage();
  if (!found) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    return;
  }

  if (activeScreen === found.screen && activeCleanup) return;

  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }

  try {
    activeCleanup = enhanceTodo(found.screen, found.todoRoot);
  } catch (error) {
    console.error('[NexusNova To-Do] full-screen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    restoreThemeMeta();
    activeScreen = null;
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(syncTodoEnhancement));
  observer.observe(stage, { childList:true, subtree:true });
  syncTodoEnhancement();
}
