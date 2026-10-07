import { appState, navigate, showToast } from './app.js';
import { listenProfile } from '../data/repo.js';
import { credit, redeem, undo, awardManual } from '../data/tx.js';
import { creditGrades, levelOf } from '../engine/economy.js';
import { getInitials } from '../data/names-db.js';
import { generateQRUrl } from '../engine/qr-protocol.js';

let unsubscribeProfile = null;
let profile = null;
let selectedGrades = [];
let inactivityTimer = null;

export function renderStudentPanel(root) {
  const { uuid, alias } = appState.currentStudent;
  const initials = getInitials(alias);
  const aliasDisplay = initials ? `${alias} (${initials})` : alias;
  
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <button id="btn-back-list" class="primary" style="padding: 6px 12px; font-size: 13px;">← До списку</button>
        <h2 style="margin:0; font-size: 18px;">${aliasDisplay}</h2>
        <button id="btn-to-scanner-top" class="primary" style="padding: 6px 12px; font-size: 13px;">📷 Сканер</button>
      </div>

      <!-- Картка учня з балансом та QR-кнопкою -->
      <div class="surface-card flex justify-between items-center" style="margin-bottom: var(--spacing-md); padding: 12px 16px;">
        <div>
          <div style="font-size: 12px; color: var(--muted);" id="panel-level">Рівень: ...</div>
          <div style="font-size: 32px; font-weight: bold; color: var(--star); line-height: 1.1;" id="panel-balance">-- ✦</div>
        </div>
        <button id="btn-open-qr" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); padding: 8px 12px; font-size: 13px;">
          📱 QR для учня
        </button>
      </div>

      <!-- Оцінки -->
      <div class="surface-card" style="margin-bottom: var(--spacing-md);">
        <p class="text-muted" style="margin-top:0; font-weight: 600;">Оцінки з щоденника:</p>
        <div id="grades-grid" class="grades-grid"></div>
        
        <div id="calc-preview" style="min-height: 24px; margin-bottom: var(--spacing-md); color: var(--ok); font-weight: bold; font-size: 14px;"></div>
        
        <button id="btn-credit" class="primary" style="width: 100%;" disabled>Зарахувати оцінки</button>
      </div>

      <!-- Нагороди та квести -->
      <div class="surface-card">
        <p class="text-muted" style="margin-top:0; font-weight: 600;">Обмін на нагороди:</p>
        <div id="shop-list" class="shop-grid"></div>
        
        <p class="text-muted" style="margin-top: var(--spacing-md); margin-bottom: 8px; font-weight: 600;">Ручні квести («Внесок у клас»):</p>
        <div id="quests-list" class="shop-grid"></div>
      </div>

      <div class="flex gap-sm" style="margin-top: var(--spacing-md);">
        <button id="btn-next-student" class="primary" style="flex:1; padding: 12px;">📷 Наступний учень (сканер)</button>
        <button id="btn-back-bottom" style="flex:1; padding: 12px; background: var(--surface);">👥 До списку учнів</button>
      </div>
    </div>

    <!-- Модальне вікно для QR-коду учня -->
    <div id="student-qr-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:200; align-items:center; justify-content:center; padding:16px;">
      <div class="surface-card text-center" style="max-width:320px; width:100%; padding:24px;">
        <h3 style="margin-top:0; margin-bottom:4px;">${aliasDisplay}</h3>
        <p class="text-muted" style="font-size:12px; margin-bottom:12px;">Учень може відсканувати цей QR прямо зараз:</p>
        <div id="panel-qr-container" style="background:white; padding:12px; border-radius:12px; display:inline-block; margin-bottom:12px;"></div>
        <div id="panel-url-text" class="text-muted" style="font-size:11px; word-break:break-all; margin-bottom:16px;"></div>
        <div class="flex gap-sm">
          <button id="btn-copy-url" style="flex:1; padding:8px; font-size:13px;">📋 Скопіювати</button>
          <button id="btn-close-qr" class="primary" style="flex:1; padding:8px; font-size:13px;">Закрити</button>
        </div>
      </div>
    </div>
  `;

  resetInactivityTimer();
  document.body.addEventListener('click', resetInactivityTimer);

  // Навігаційні слухачі
  const goBackToList = () => {
    cleanup();
    appState.currentStudent = null;
    navigate('student-list');
  };

  const goToScanner = () => {
    cleanup();
    appState.currentStudent = null;
    navigate('scanner');
  };

  document.getElementById('btn-back-list').addEventListener('click', goBackToList);
  document.getElementById('btn-back-bottom').addEventListener('click', goBackToList);
  document.getElementById('btn-to-scanner-top').addEventListener('click', goToScanner);
  document.getElementById('btn-next-student').addEventListener('click', goToScanner);

  // Модальне вікно QR
  const qrModal = document.getElementById('student-qr-modal');
  document.getElementById('btn-open-qr').addEventListener('click', () => {
    const url = generateQRUrl({ type: 'P', uuid, alias });
    const qrContainer = document.getElementById('panel-qr-container');
    document.getElementById('panel-url-text').textContent = url;
    qrContainer.innerHTML = '';
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      qrContainer.innerHTML = qr.createImgTag(5, 0);
    }
    qrModal.style.display = 'flex';
  });

  document.getElementById('btn-close-qr').addEventListener('click', () => {
    qrModal.style.display = 'none';
  });
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.style.display = 'none';
  });

  document.getElementById('btn-copy-url').addEventListener('click', () => {
    const url = generateQRUrl({ type: 'P', uuid, alias });
    navigator.clipboard.writeText(url).then(() => {
      showToast('Посилання скопійовано!');
    }).catch(() => {
      prompt('Скопіюйте посилання:', url);
    });
  });

  // Підписка на профіль
  unsubscribeProfile = listenProfile(uuid, p => {
    profile = p;
    updatePanel();
  }, err => {
    console.error(err);
    goToScanner();
  });

  renderGradesGrid();
  renderShop();
  renderQuests();

  document.getElementById('btn-credit').addEventListener('click', handleCredit);
}

function cleanup() {
  if (unsubscribeProfile) {
    unsubscribeProfile();
    unsubscribeProfile = null;
  }
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  document.body.removeEventListener('click', resetInactivityTimer);
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    cleanup();
    appState.currentStudent = null;
    navigate('scanner');
  }, 90000); // 90 секунд таймаут
}

function renderGradesGrid() {
  const grid = document.getElementById('grades-grid');
  const gradesConf = appState.config.grades || { "12": 6, "11": 5, "10": 4, "9": 3, "8": 2, "7": 1 };
  grid.innerHTML = '';
  Object.keys(gradesConf).sort((a,b) => Number(b) - Number(a)).forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'grade-btn';
    btn.textContent = g;
    btn.addEventListener('click', () => {
      const idx = selectedGrades.indexOf(Number(g));
      if (idx > -1) {
        selectedGrades.splice(idx, 1);
        btn.classList.remove('selected');
      } else {
        selectedGrades.push(Number(g));
        btn.classList.add('selected');
      }
      updatePreview();
    });
    grid.appendChild(btn);
  });
}

function updatePreview() {
  const preview = document.getElementById('calc-preview');
  const btnCredit = document.getElementById('btn-credit');
  if (selectedGrades.length === 0 || !profile) {
    preview.textContent = '';
    btnCredit.disabled = true;
    return;
  }
  
  try {
    const res = creditGrades(profile, selectedGrades, appState.config, Date.now());
    let questBonus = '';
    if (res.events && res.events.length > 0) {
      questBonus = ' + бонус квестів: ' + res.events.map(e => `+${e.delta} ✦`).join(', ');
    }
    preview.textContent = `Вибрано оцінки: [ ${selectedGrades.join(', ')} ] → Разом: +${res.delta} ✦${questBonus}`;
    btnCredit.disabled = false;
  } catch (err) {
    preview.textContent = err.message.startsWith('grade-not-allowed') ? 'Неприпустима оцінка' : 'Помилка розрахунку';
    btnCredit.disabled = true;
  }
}

async function handleCredit() {
  if (selectedGrades.length === 0 || !profile) return;
  const grades = [...selectedGrades];
  
  const opId = crypto.randomUUID();
  try {
    const res = await credit(profile.id, opId, appState.config, grades);
    if (res.ok) {
      showToast(`Зараховано +${res.delta} ✦`, {
        text: 'Скасувати',
        handler: async () => {
          await undo(profile.id, crypto.randomUUID(), appState.config, { id: opId, type: 'credit', delta: res.delta });
          showToast('Скасовано');
        }
      });
      // Очистити вибір
      selectedGrades = [];
      document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
      updatePreview();
    }
  } catch (err) {
    console.error(err);
    alert("Помилка збереження: " + err.message);
  }
}

function renderShop() {
  const shopList = document.getElementById('shop-list');
  if (!shopList || !profile) return;
  
  const shop = (appState.config.shop || []).filter(item => item.active !== false);
  shopList.innerHTML = '';
  
  shop.forEach(item => {
    const canAfford = profile.balance >= item.price;
    const btn = document.createElement('button');
    btn.className = `shop-item ${canAfford ? '' : 'disabled'}`;
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.innerHTML = `
      <span style="font-size: 16px; font-weight: bold;">${item.icon} ${item.name}</span>
      <span style="font-weight: bold; color: ${canAfford ? 'var(--ok)' : 'var(--text)'};">
        ${item.price} ✦ ${canAfford ? '' : '(бракує ' + (item.price - profile.balance) + ')'}
      </span>
    `;
    
    if (canAfford) {
      btn.addEventListener('click', () => handleRedeem(item));
    }
    shopList.appendChild(btn);
  });
}

function renderQuests() {
  const questsList = document.getElementById('quests-list');
  if (!questsList || !profile) return;
  
  const quests = (appState.config.quests || []).filter(q => q.active !== false && q.type === 'manual');
  questsList.innerHTML = '';
  
  quests.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.innerHTML = `
      <span style="font-size: 16px; font-weight: bold;">${q.icon} ${q.title || q.name}</span>
      <span style="color: var(--ok); font-weight: bold;">+${q.reward} ✦</span>
    `;
    btn.addEventListener('click', () => handleManualQuest(q));
    questsList.appendChild(btn);
  });
}

async function handleRedeem(itemObj) {
  if (!confirm(`Списати ${itemObj.price} ✦ за "${itemObj.name}"?`)) return;
  const opId = crypto.randomUUID();
  try {
    const res = await redeem(profile.id, opId, appState.config, itemObj, 1);
    if (res.ok) {
      showToast(`Видано ${itemObj.icon} −${itemObj.price} ✦ (Залишок: ${profile.balance - itemObj.price} ✦)`, {
        text: 'Скасувати',
        handler: async () => {
          await undo(profile.id, crypto.randomUUID(), appState.config, { id: opId, type: 'redeem', delta: -itemObj.price });
          showToast('Скасовано');
        }
      });
    }
  } catch (err) {
    console.error(err);
    alert(err.message === 'insufficient-funds' ? 'Недостатньо ✦' : err.message);
  }
}

async function handleManualQuest(quest) {
  if (!confirm(`Зарахувати нагороду +${quest.reward} ✦ за "${quest.title || quest.name}"?`)) return;
  const opId = crypto.randomUUID();
  try {
    const res = await awardManual(profile.id, opId, appState.config, quest.id);
    if (res.ok) {
      showToast(`Нагорода ${quest.icon} зарахована +${res.delta} ✦`, {
        text: 'Скасувати',
        handler: async () => {
          await undo(profile.id, crypto.randomUUID(), appState.config, { id: opId, type: 'quest', delta: res.delta });
          showToast('Скасовано');
        }
      });
    }
  } catch (err) {
    console.error(err);
    alert(err.message === 'quest-limit-reached' ? 'Місячний ліміт виконань вичерпано' : err.message);
  }
}

function updatePanel() {
  const balEl = document.getElementById('panel-balance');
  if (balEl) balEl.textContent = `${profile.balance} ✦`;
  
  const lvlEl = document.getElementById('panel-level');
  if (lvlEl && appState.config) {
    const lvl = levelOf(profile.earned, appState.config);
    lvlEl.textContent = `Рівень: ${lvl.name} (зароблено ${profile.earned} ✦)`;
  }

  updatePreview();
  renderShop();
  renderQuests();
}
