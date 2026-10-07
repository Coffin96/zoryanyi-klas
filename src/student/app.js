import { listenConfig, listenProfile } from '../data/repo.js';
import { renderHome } from './home.js';
import { renderQr } from './qr.js';
import { renderShop } from './shop.js';
import { renderQuests } from './quests.js';
import { renderHistory } from './history.js';

export const state = {
  uuid: null,
  profile: null,
  config: null,
  view: 'home',
  offline: !navigator.onLine,
  toastTimeout: null
};

export function initStudentApp() {
  const urlParams = new URLSearchParams(window.location.search);
  let u = urlParams.get('u');
  
  if (!u && window.location.hash) {
    const hashMatch = window.location.hash.match(/#\/p\/([0-9a-f-]{36})/i);
    if (hashMatch) {
      u = hashMatch[1];
    }
  }
  
  if (u) {
    localStorage.setItem('zk_student_uuid', u);
    // clear URL so it's not visible
    window.history.replaceState({}, document.title, window.location.pathname);
    state.uuid = u;
  } else {
    state.uuid = localStorage.getItem('zk_student_uuid');
  }

  window.addEventListener('online', () => { state.offline = false; renderApp(); });
  window.addEventListener('offline', () => { state.offline = true; renderApp(); });

  if (state.uuid) {
    listenConfig(
      c => { state.config = c; renderApp(); },
      e => console.error("Config error:", e)
    );
    listenProfile(state.uuid,
      p => { 
        // Track balance changes to show receipt
        if (state.profile && p.balance !== state.profile.balance) {
          const delta = p.balance - state.profile.balance;
          if (delta > 0) {
            showStudentToast(`+${delta} ✦`);
          } else {
            showStudentToast(`${delta} ✦ (Залишок: ${p.balance} ✦)`);
          }
        }
        state.profile = p;
        // Cache last known profile for offline support
        localStorage.setItem('zk_last_profile', JSON.stringify(p));
        renderApp();
      },
      e => {
        console.error("Profile error:", e);
        if (state.offline) {
          const cached = localStorage.getItem('zk_last_profile');
          if (cached) {
            state.profile = JSON.parse(cached);
            renderApp();
          }
        }
      }
    );
  } else {
    renderApp();
  }
}

export function navigate(view) {
  state.view = view;
  renderApp();
}

export function logout() {
  if (confirm("Відв'язати цей пристрій від учня?")) {
    localStorage.removeItem('zk_student_uuid');
    localStorage.removeItem('zk_last_profile');
    location.reload();
  }
}

export function showStudentToast(msg) {
  let toast = document.getElementById('student-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'student-toast';
    toast.className = 'receipt-toast';
    toast.setAttribute('aria-live', 'polite');
    // Ensure it displays above nav bar
    toast.style.bottom = '80px';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  
  if (state.toastTimeout) clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!state.uuid) {
    root.innerHTML = `
      <div class="container flex flex-col items-center justify-center text-center" style="min-height: 100vh;">
        <h1 class="text-xl">Зоряний клас</h1>
        <p class="text-muted">Відскануй свій унікальний QR-код вчителем, щоб отримати посилання для входу.</p>
      </div>
    `;
    return;
  }

  if (!state.profile || !state.config) {
    root.innerHTML = `
      <div class="container flex flex-col items-center justify-center text-center" style="min-height: 100vh;">
        <h1 class="text-xl">Завантаження...</h1>
        ${state.offline ? '<p class="text-muted">Немає зв\'язку з інтернетом</p>' : ''}
      </div>
    `;
    return;
  }

  // Main layout
  root.innerHTML = `
    ${state.offline ? '<div style="background:var(--muted); color:white; text-align:center; padding:4px; font-size:12px;">Немає зв\'язку, показано останній баланс</div>' : ''}
    <div id="view-container" style="padding-bottom: 70px;"></div>
    
    <nav style="position:fixed; bottom:0; width:100%; background:var(--surface); display:flex; justify-content:space-around; padding:var(--spacing-sm); border-top: 1px solid var(--bg); z-index:100;">
      <button class="nav-btn ${state.view === 'home' ? 'active' : ''}" data-view="home" style="flex:1; background:transparent; display:flex; flex-direction:column; min-height:auto;">
        <span style="font-size:24px;">✦</span>
        <span style="font-size:12px;">Мої ✦</span>
      </button>
      <button class="nav-btn ${state.view === 'qr' ? 'active' : ''}" data-view="qr" style="flex:1; background:transparent; display:flex; flex-direction:column; min-height:auto;">
        <span style="font-size:24px;">📱</span>
        <span style="font-size:12px;">Мій QR</span>
      </button>
      <button class="nav-btn ${state.view === 'shop' ? 'active' : ''}" data-view="shop" style="flex:1; background:transparent; display:flex; flex-direction:column; min-height:auto;">
        <span style="font-size:24px;">🛒</span>
        <span style="font-size:12px;">Магазин</span>
      </button>
      <button class="nav-btn ${state.view === 'quests' ? 'active' : ''}" data-view="quests" style="flex:1; background:transparent; display:flex; flex-direction:column; min-height:auto;">
        <span style="font-size:24px;">🏆</span>
        <span style="font-size:12px;">Квести</span>
      </button>
      <button class="nav-btn ${state.view === 'history' ? 'active' : ''}" data-view="history" style="flex:1; background:transparent; display:flex; flex-direction:column; min-height:auto;">
        <span style="font-size:24px;">📜</span>
        <span style="font-size:12px;">Історія</span>
      </button>
    </nav>
  `;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
    if (btn.classList.contains('active')) {
      btn.style.color = 'var(--accent)';
    } else {
      btn.style.color = 'var(--muted)';
    }
  });

  const viewContainer = document.getElementById('view-container');
  
  if (state.view === 'home') renderHome(viewContainer, state);
  else if (state.view === 'qr') renderQr(viewContainer, state);
  else if (state.view === 'shop') renderShop(viewContainer, state);
  else if (state.view === 'quests') renderQuests(viewContainer, state);
  else if (state.view === 'history') renderHistory(viewContainer, state);
}
