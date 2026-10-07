import { listenLedger } from '../data/repo.js';

export function renderHistory(root, state) {
  root.innerHTML = `
    <div class="container">
      <h2>Статистика та Історія</h2>
      
      <div id="stats-container" class="surface-card flex flex-col gap-sm" style="margin-bottom: var(--spacing-md); display: none;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--muted);">Мої оцінки</h3>
        <div id="grade-stats-list" class="flex gap-sm" style="flex-wrap: wrap;"></div>
      </div>

      <div id="history-list" class="flex flex-col gap-sm">
        <p class="text-muted text-center" style="margin-top: 20px;">Завантаження...</p>
      </div>
    </div>
  `;

  if (state.profile && state.profile.stats && state.profile.stats.gradeCount) {
    const grades = state.profile.stats.gradeCount;
    const statsList = document.getElementById('grade-stats-list');
    const statsContainer = document.getElementById('stats-container');
    let hasStats = false;
    
    // Sort keys descending (e.g. 12, 11, 10, 9...)
    const sortedGrades = Object.keys(grades).sort((a, b) => Number(b) - Number(a));
    
    let statsHtml = '';
    sortedGrades.forEach(grade => {
      if (grades[grade] > 0) {
        hasStats = true;
        statsHtml += `
          <div style="background: var(--bg); padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-weight: bold; font-size: 16px;">${grade}</span>
            <span class="text-muted" style="margin-left: 4px; font-size: 12px;">× ${grades[grade]}</span>
          </div>
        `;
      }
    });

    if (hasStats) {
      statsList.innerHTML = statsHtml;
      statsContainer.style.display = 'flex';
    }
  }

  // We could cache the listener, but for simplicity we fetch it each time the view is opened.
  // In a more robust app, we'd unsubscribe when navigating away.
  const unsubscribe = listenLedger(state.uuid, 20, (items) => {
    const listDiv = document.getElementById('history-list');
    if (!listDiv) {
      unsubscribe(); // the user navigated away
      return;
    }

    if (items.length === 0) {
      listDiv.innerHTML = '<p class="text-muted text-center" style="margin-top: 20px;">Історія порожня</p>';
      return;
    }

    listDiv.innerHTML = items.map(item => {
      const isPositive = item.delta > 0;
      const date = new Date(item.ts).toLocaleString('uk-UA', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      });

      return `
        <div class="surface-card flex justify-between items-center" style="padding: 12px 16px;">
          <div>
            <div style="font-weight: bold; margin-bottom: 2px;">${item.desc}</div>
            <div class="text-muted" style="font-size: 12px;">${date}</div>
          </div>
          <div style="font-weight: bold; font-size: 16px; color: ${isPositive ? 'var(--star)' : 'var(--text)'};">
            ${isPositive ? '+' : ''}${item.delta} ✦
          </div>
        </div>
      `;
    }).join('');
  }, err => {
    const listDiv = document.getElementById('history-list');
    if (listDiv) {
      listDiv.innerHTML = '<p class="text-muted text-center" style="margin-top: 20px;">Помилка завантаження історії</p>';
    }
  });
}
