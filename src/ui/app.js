import { onTeacherStateChanged } from '../data/firebase.js';
import { listenConfig, listenStock } from '../data/repo.js';
import { renderAuth } from './auth.js';
import { renderScanner } from './scanner.js';
import { renderStudentPanel } from './student-panel.js';
import { renderStudentList } from './student-list.js';
import { renderAdmin } from './admin.js';

export const appState = {
  user: null,
  config: null,
  stock: null,
  view: 'auth', // 'auth', 'scanner', 'student-panel', 'student-list'
  currentStudent: null, // { uuid, alias }
  toastTimeout: null
};

export function initApp() {
  onTeacherStateChanged(user => {
    appState.user = user;
    if (user) {
      appState.view = 'scanner';
      listenConfig(
        c => { appState.config = c; render(); },
        e => console.error(e)
      );
      listenStock(
        s => { appState.stock = s; render(); },
        e => console.error(e)
      );
    } else {
      appState.view = 'auth';
      render();
    }
  });
}

export function navigate(view, params = {}) {
  appState.view = view;
  if (view === 'student-panel') {
    appState.currentStudent = params.student;
  }
  render();
}

export function showToast(msg, action = null) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'receipt-toast flex justify-between items-center gap-md';
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  
  toast.innerHTML = `<span>${msg}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.text;
    btn.style.padding = '4px 8px';
    btn.style.minHeight = 'auto';
    btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
    btn.addEventListener('click', () => {
      action.handler();
      toast.classList.remove('show');
    });
    toast.appendChild(btn);
  }

  toast.classList.add('show');
  
  if (appState.toastTimeout) clearTimeout(appState.toastTimeout);
  appState.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  if (appState.view === 'auth') {
    renderAuth(root);
  } else if (!appState.config) {
    root.innerHTML = '<div class="container text-center p-md">Завантаження конфігурації...</div>';
  } else if (appState.view === 'scanner') {
    renderScanner(root);
  } else if (appState.view === 'student-panel') {
    renderStudentPanel(root);
  } else if (appState.view === 'student-list') {
    renderStudentList(root);
  } else if (appState.view === 'admin') {
    renderAdmin(root);
  }
}
