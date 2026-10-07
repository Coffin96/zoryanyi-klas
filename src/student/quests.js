export function renderQuests(root, state) {
  const p = state.profile;
  const c = state.config;
  const quests = c.quests || [];
  const nowMs = Date.now();

  root.innerHTML = `
    <div class="container">
      <h2>Квести та ліміти</h2>
      <p class="text-muted" style="margin-bottom: var(--spacing-md);">Покажи свій QR вчителю, щоб здати квест.</p>
      
      <div class="flex flex-col gap-sm">
        ${quests.map(quest => {
          let limitText = '';
          let progressHtml = '';
          
          if (quest.limit !== 'none') {
            const stockKey = \`q_\${quest.id}\`;
            const stockEntry = p.stock && p.stock[stockKey] ? p.stock[stockKey] : { count: 0, resetAt: 0 };
            const isLimitActive = stockEntry.resetAt > nowMs;
            const currentCount = isLimitActive ? stockEntry.count : 0;
            const limitMax = quest.limitValue || 0;
            
            let periodStr = quest.limit === 'day' ? 'на день' : (quest.limit === 'week' ? 'на тиждень' : 'на місяць');
            limitText = \`\${currentCount} / \${limitMax} \${periodStr}\`;
            
            const percent = Math.min(100, Math.floor((currentCount / limitMax) * 100));
            progressHtml = `
              <div style="margin-top: var(--spacing-sm);">
                <div class="flex justify-between text-muted" style="font-size: 12px; margin-bottom: 4px;">
                  <span>Виконано</span>
                  <span>${limitText}</span>
                </div>
                <div style="width: 100%; background: var(--bg); height: 6px; border-radius: 3px; overflow: hidden;">
                  <div style="width: ${percent}%; background: ${currentCount >= limitMax ? 'var(--danger)' : 'var(--accent)'}; height: 100%;"></div>
                </div>
              </div>
            `;
          }

          return `
            <div class="surface-card">
              <div class="flex justify-between items-start">
                <div class="flex items-center gap-sm">
                  <span style="font-size: 24px;">${quest.icon}</span>
                  <div>
                    <div style="font-weight: bold;">${quest.name}</div>
                    <div class="text-muted" style="font-size: 12px;">${quest.desc}</div>
                  </div>
                </div>
                <div style="font-weight: bold; color: var(--star); white-space: nowrap;">
                  +${quest.reward} ✦
                </div>
              </div>
              ${progressHtml}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
