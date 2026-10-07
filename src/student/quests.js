import { kyivParts } from '../engine/time.js';

export function renderQuests(root, state) {
  const p = state.profile;
  const c = state.config;
  const quests = (c.quests || []).filter(q => q.active);
  const nowMs = Date.now();
  const { month } = kyivParts(nowMs);
  const monthCounters = (p.counters && p.counters[month]) || {};
  const monthStars = monthCounters.questStars || 0;
  const monthlyCap = c.questMonthlyCap || 8;
  const capPercent = Math.min(100, Math.floor((monthStars / monthlyCap) * 100));

  root.innerHTML = `
    <div class="container">
      <h2>Квести місяця</h2>
      <p class="text-muted" style="margin-bottom: var(--spacing-md);">Виконуй завдання та отримуй додаткові зірки!</p>
      
      <div class="surface-card" style="margin-bottom: var(--spacing-md);">
        <div class="flex justify-between items-center" style="margin-bottom: 6px;">
          <span style="font-weight: 600;">Зароблено за квести у цьому місяці:</span>
          <span style="font-weight: bold; color: var(--star);">${monthStars} / ${monthlyCap} ✦</span>
        </div>
        <div style="width: 100%; background: var(--bg); height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="width: ${capPercent}%; background: ${monthStars >= monthlyCap ? 'var(--ok)' : 'var(--accent)'}; height: 100%;"></div>
        </div>
      </div>

      <div class="flex flex-col gap-sm">
        ${quests.map(quest => {
          const count = monthCounters[quest.id] || 0;
          const limit = quest.perMonth || 2;
          const isDone = count >= limit || monthStars >= monthlyCap;
          const percent = Math.min(100, Math.floor((count / limit) * 100));

          let desc = quest.desc;
          if (!desc) {
            if (quest.type === 'growth') desc = 'Отримай оцінку, вищу за середній бал твоїх робіт';
            else if (quest.type === 'streak') desc = '3 оцінки від 8 балів протягом 7 днів';
            else if (quest.type === 'manual') desc = 'Корисна допомога класу або спільній справі';
            else desc = 'Спеціальне завдання';
          }

          return `
            <div class="surface-card">
              <div class="flex justify-between items-start">
                <div class="flex items-center gap-sm">
                  <span style="font-size: 28px;">${quest.icon || '🏆'}</span>
                  <div>
                    <div style="font-weight: bold; font-size: 16px;">${quest.title || quest.name}</div>
                    <div class="text-muted" style="font-size: 13px;">${desc}</div>
                  </div>
                </div>
                <div style="font-weight: bold; color: var(--star); white-space: nowrap; font-size: 17px;">
                  +${quest.reward} ✦
                </div>
              </div>

              <div style="margin-top: var(--spacing-sm);">
                <div class="flex justify-between text-muted" style="font-size: 12px; margin-bottom: 4px;">
                  <span>${isDone ? (count >= limit ? 'Місячний ліміт виконано ✓' : 'Ліміт зірок вичерпано') : 'Прогрес цього місяця:'}</span>
                  <span style="font-weight: 600;">${count} / ${limit}</span>
                </div>
                <div style="width: 100%; background: var(--bg); height: 6px; border-radius: 3px; overflow: hidden;">
                  <div style="width: ${percent}%; background: ${isDone ? 'var(--ok)' : 'var(--accent)'}; height: 100%;"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
