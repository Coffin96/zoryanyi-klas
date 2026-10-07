import { listenLedger } from '../data/repo.js';

export function renderHistory(root, state) {
  root.innerHTML = `
    <div class="container">
      <h2>Історія</h2>
      <div id="history-list" class="flex flex-col gap-sm">
        <p class="text-muted text-center" style="margin-top: 20px;">Завантаження...</p>
      </div>
    </div>
  `;

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
