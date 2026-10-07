import { navigate, appState } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { getInitials } from '../data/names-db.js';

export async function renderStudentList(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <button id="btn-back" class="primary">Назад</button>
        <h2 style="margin:0;">Список учнів</h2>
        <button id="btn-admin" class="primary">Адмін</button>
      </div>

      <div class="surface-card">
        <input type="text" id="search" placeholder="Пошук за псевдонімом..." style="margin-bottom: var(--spacing-md);">
        <div id="list-container" class="flex flex-col gap-sm">
          Завантаження...
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', () => {
    navigate('scanner');
  });

  document.getElementById('btn-admin').addEventListener('click', () => {
    navigate('admin');
  });

  try {
    const profiles = await getActiveProfiles();
    const listContainer = document.getElementById('list-container');
    const searchInput = document.getElementById('search');

    const renderList = (filter) => {
      const filtered = profiles.filter(p => p.alias.toLowerCase().includes(filter.toLowerCase()));
      if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-muted text-center">Нікого не знайдено</p>';
        return;
      }
      listContainer.innerHTML = filtered.map(p => {
        const initials = getInitials(p.alias);
        const display = initials ? `${p.alias} <span class="text-muted">(${initials})</span>` : p.alias;
        return `
        <button class="shop-item" data-id="${p.id}" data-alias="${p.alias}">
          <span style="font-size: 18px; font-weight: bold;">${display}</span>
          <span style="color: var(--star); font-weight: bold;">${p.balance} ✦</span>
        </button>
      `}).join('');

      listContainer.querySelectorAll('.shop-item').forEach(btn => {
        btn.addEventListener('click', () => {
          navigate('student-panel', { student: { uuid: btn.dataset.id, alias: btn.dataset.alias } });
        });
      });
    };

    renderList('');
    searchInput.addEventListener('input', (e) => renderList(e.target.value));

  } catch (err) {
    console.error(err);
    document.getElementById('list-container').innerHTML = '<p class="error-text">Помилка завантаження</p>';
  }
}
