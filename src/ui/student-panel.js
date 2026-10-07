import { appState, navigate, showToast } from './app.js';
import { listenProfile } from '../data/repo.js';
import { credit, redeem, undo, awardManual } from '../data/tx.js';
import { creditGrades } from '../engine/economy.js';
import { texts, formatStars } from '../i18n/uk.js';
import { getInitials } from '../data/names-db.js';

let unsubscribeProfile = null;
let profile = null;
let selectedGrades = [];
let inactivityTimer = null;
let localOrders = {};

export function renderStudentPanel(root) {
  const { uuid, alias } = appState.currentStudent;
  const initials = getInitials(alias);
  const aliasDisplay = initials ? `${alias} (${initials})` : alias;
  
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <button id="btn-back" class="primary">Повернутись</button>
        <h2 style="margin:0;">${aliasDisplay}</h2>
        <h2 style="margin:0; color: var(--star);" id="panel-balance">-- ✦</h2>
      </div>

      <div class="surface-card" style="margin-bottom: var(--spacing-md);">
        <p class="text-muted" style="margin-top:0;">Оцінки:</p>
        <div id="grades-grid" class="grades-grid"></div>
        
        <div id="calc-preview" style="min-height: 24px; margin-bottom: var(--spacing-md); color: var(--ok); font-weight: bold;"></div>
        
        <button id="btn-credit" class="primary" style="width: 100%;" disabled>Зарахувати</button>
      </div>

      <div class="surface-card">
        <p class="text-muted" style="margin-top:0;">Нагороди:</p>
        <div id="shop-list" class="shop-grid"></div>
        <div id="quests-list" class="shop-grid" style="margin-top: var(--spacing-md);"></div>
      </div>
    </div>
  `;

  resetInactivityTimer();
  document.body.addEventListener('click', resetInactivityTimer);

  document.getElementById('btn-back').addEventListener('click', closePanel);

  unsubscribeProfile = listenProfile(uuid, p => {
    profile = p;
    updatePanel();
  }, err => {
    console.error(err);
    closePanel();
  });

  renderGradesGrid();
  renderShop();
  renderQuests();

  document.getElementById('btn-credit').addEventListener('click', handleCredit);
}

function closePanel() {
  if (unsubscribeProfile) unsubscribeProfile();
  if (inactivityTimer) clearTimeout(inactivityTimer);
  document.body.removeEventListener('click', resetInactivityTimer);
  appState.currentStudent = null;
  navigate('scanner');
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(closePanel, 60000);
}

function renderGradesGrid() {
  const grid = document.getElementById('grades-grid');
  const gradesConf = appState.config.grades;
  grid.innerHTML = '';
  Object.keys(gradesConf).sort((a,b) => Number(b) - Number(a)).forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'grade-btn';
    btn.textContent = g;
    btn.addEventListener('click', () => {
      const idx = selectedGrades.indexOf(g);
      if (idx > -1) {
        selectedGrades.splice(idx, 1);
        btn.classList.remove('selected');
      } else {
        selectedGrades.push(g);
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
    preview.textContent = `Вибрано: ${selectedGrades.join(', ')} → +${res.delta} ✦` + 
      (res.events.length > 0 ? ` (${res.events.map(e => '+' + e.delta + ' ✦ ' + e.quest).join(', ')})` : '');
    btnCredit.disabled = false;
  } catch (err) {
    preview.textContent = err.message === 'too-many-grades' ? 'Забагато оцінок' : 'Помилка розрахунку';
    btnCredit.disabled = true;
  }
}

async function handleCredit() {
  if (selectedGrades.length === 0 || !profile) return;
  const grades = [...selectedGrades];
  
  // soft warning if recent contains exact same grades (simple check)
  if (profile.recent && profile.recent.length > 0) {
    const isRepeat = profile.recent.some(r => r.type === 'credit' && JSON.stringify(r.entries) === JSON.stringify(grades));
    if (isRepeat) {
      if (!confirm(`Щойно вже зараховували ${grades.join(', ')}. Підтвердити ще раз?`)) return;
    }
  }

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
      // clear selection
      selectedGrades = [];
      document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
      updatePreview();
    }
  } catch (err) {
    console.error(err);
    alert("Помилка збереження");
  }
}

function renderShop() {
  const shopList = document.getElementById('shop-list');
  if (!shopList || !profile) return;
  
  const shop = appState.config.shop || [];
  shopList.innerHTML = '';
  
  shop.forEach(item => {
    // Basic check for UI. Actual validation happens in tx/engine.
    const canAfford = profile.balance >= item.price;
    const btn = document.createElement('button');
    btn.className = `shop-item ${canAfford ? '' : 'disabled'}`;
    btn.innerHTML = `
      <span style="font-size: 18px; font-weight: bold;">${item.icon} ${item.name}</span>
      <span style="font-weight: bold;">${canAfford ? item.price + ' ✦' : 'ще ' + (item.price - profile.balance) + ' ✦'}</span>
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
  
  const quests = appState.config.quests || [];
  questsList.innerHTML = '';
  
  quests.filter(q => q.type === 'manual').forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.innerHTML = `
      <span style="font-size: 18px; font-weight: bold;">${q.icon} ${q.title}</span>
      <span style="color: var(--ok); font-weight: bold;">+${q.reward} ✦</span>
    `;
    btn.addEventListener('click', () => handleManualQuest(q));
    questsList.appendChild(btn);
  });
}

async function handleRedeem(itemObj) {
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
    alert(err.message === 'quest-limit-reached' ? 'Ліміт виконань на місяць вичерпано' : err.message);
  }
}

function updatePanel() {
  document.getElementById('panel-balance').textContent = `${profile.balance} ✦`;
  updatePreview();
  renderShop();
  renderQuests();
}
