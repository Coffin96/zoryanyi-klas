import { kyivParts } from '../engine/time.js';
import { validateQuest, getQuestSecretState } from '../engine/quests.js';
import { 
  iconFiligreeDivider, 
  iconFlame, 
  iconGrowth, 
  iconContrib, 
  iconPrimogem 
} from '../components/genshin-icons.js';

export function getDisplayQuests(quests, p = {}, context = {}) {
  const lifetimeQuests = quests.filter(q => (q.type === 'lifetime_milestone' || q.period === 'lifetime') && !q.secret);
  lifetimeQuests.sort((a, b) => (a.target || 0) - (b.target || 0));

  const nextLifetimeQuest = lifetimeQuests.find(q => {
    const isDone = Math.max(p.counters?.lifetime?.[q.id] || 0, p.stats?.quests?.[q.id] || 0) >= (q.limit ?? 1);
    return !isDone;
  });

  const baseQuests = quests.filter(q => !q.secret);
  const result = [];

  for (const q of baseQuests) {
    const isLife = q.type === 'lifetime_milestone' || q.period === 'lifetime';
    if (isLife) {
      if (nextLifetimeQuest) {
        if (q.id !== nextLifetimeQuest.id) continue;
      } else if (lifetimeQuests.length > 0 && q.id !== lifetimeQuests[lifetimeQuests.length - 1].id) {
        continue;
      }
    }

    const sq = quests.find(x => x.parentQuestId === q.id);
    if (sq) {
      const secState = getQuestSecretState(p, sq, quests, context);
      if (!secState.isLocked && secState.isRevealed) {
        result.push(sq);
        continue;
      }
    }
    result.push(q);
  }

  return result;
}

export function renderQuests(root, state) {
  const p = state.profile;
  const c = state.config;
  const quests = (c.quests || []).filter(q => q.active);
  const nowMs = Date.now();
  const { month, week, ymd } = kyivParts(nowMs);
  
  // Тижневі та місячні лічильники
  const weekCounters = (p.counters && p.counters[week]) || {};
  const monthCounters = (p.counters && p.counters[month]) || {};
  
  const monthStars = monthCounters.questStars || 0;

  // Щоденний квест (чекін)
  const dailyQuest = quests.find(q => q.type === 'daily_hot' || q.id === 'secret_daily_hot' || q.period === 'daily');
  let dailyCheckinHtml = '';
  if (dailyQuest) {
    const dailyDone = (p.counters?.[ymd]?.[dailyQuest.id] || 0) >= (dailyQuest.limit ?? 1);
    dailyCheckinHtml = `
      <div class="parchment-card" style="margin-bottom: var(--spacing-sm); padding: 12px 16px; background: var(--surface-parchment); border: 1.5px solid var(--gold-border);">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-sm">
            <span style="font-size: 26px;">⚡</span>
            <div>
              <div class="flex items-center gap-xs">
                <span style="font-weight: 800; font-size: 14px; color: var(--text-parchment);">${dailyQuest.title}</span>
                <span class="badge-tag" style="background: rgba(0, 210, 255, 0.15); color: #007799; border: 1px solid rgba(0, 210, 255, 0.4); font-size: 10px; padding: 1px 6px;">ЩОДЕННИЙ ЧЕКІН</span>
              </div>
              <div style="font-size: 11px; color: var(--text-parchment-muted); margin-top: 1px;">${dailyQuest.desc}</div>
            </div>
          </div>
          <div style="flex-shrink: 0; white-space: nowrap;">
            ${dailyDone ? `
              <span class="badge-tag" style="background: rgba(62, 207, 146, 0.15); color: var(--ok); border: 1px solid var(--ok); font-weight: 800; font-size: 12px; padding: 4px 10px; white-space: nowrap;">
                ✓ Виконано
              </span>
            ` : `
              <span class="badge-gold" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; padding: 3px 9px; border-radius: 12px;">
                +${dailyQuest.reward} ✦
              </span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  const displayQuests = getDisplayQuests(quests, p, { nowMs, month, week }).filter(q => q.id !== dailyQuest?.id);

  root.innerHTML = `
    <div class="container">
      <div class="text-center" style="margin-bottom: var(--spacing-sm);">
        <h2 class="fantasy-title" style="margin: 0 0 4px 0; font-size: 22px;">Квести місяця</h2>
        <p class="text-muted" style="margin: 0; font-size: 13px;">Виконуй завдання та отримуй додаткові зірки!</p>
        ${iconFiligreeDivider()}
      </div>
      
      <!-- Загальний лічильник зароблених зірок за квести -->
      <div class="parchment-card" style="margin-bottom: var(--spacing-md); padding: 14px 16px;">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-xs">
            <span style="display:inline-flex; align-items:center;">
              ${iconPrimogem(20)}
            </span>
            <span style="font-weight: 700; font-size: 14px; color: var(--text-parchment);">Зароблено бонусних зірок у цьому місяці:</span>
          </div>
          <span style="flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font-weight: 800; font-size: 16px; font-family: var(--font-fantasy); color: var(--gold-deep);">
            +${monthStars} ✦
          </span>
        </div>
      </div>

      <!-- Щоденний чекін -->
      ${dailyCheckinHtml}

      <!-- Список завдань у стилі Книги Шукача Пригод -->
      <div class="flex flex-col gap-sm">
        ${displayQuests.map(quest => {
          // Якщо це пробуджений секретний квест
          if (quest.secret) {
            const secState = getQuestSecretState(p, quest, quests, { nowMs, month, week });
            if (secState.isLocked) return '';
            const val = secState.val || validateQuest(p, quest, { nowMs, month, week });
            return `
              <div class="genshin-astral-card">
                <div class="flex justify-between items-center" style="margin-bottom: 8px;">
                  <span class="badge-astral">✦ ТАЄМНЕ ДОРУЧЕННЯ</span>
                  <span class="badge-gold" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; padding: 3px 9px; border-radius: 12px;">+${quest.reward} ✦</span>
                </div>
                <div style="font-family: var(--font-fantasy); color: var(--gold-light); font-size: 16px; font-weight: 800; margin-bottom: 3px;">
                  ${quest.title}
                </div>
                <div style="font-size: 12px; color: #c5cee8; line-height: 1.35; margin-bottom: 10px;">
                  ${quest.desc}
                </div>
                <div class="flex justify-between" style="font-size: 11px; color: var(--cyan-accent); margin-bottom: 4px;">
                  <span>Прогрес доручення:</span>
                  <span style="font-weight: 800;">${val.progress} / ${val.target} (${val.percent}%)</span>
                </div>
                <div class="genshin-progress-track">
                  <div class="genshin-progress-fill-cyan" style="width: ${val.percent}%;"></div>
                </div>
              </div>
            `;
          }

          const secretState = getQuestSecretState(p, quest, quests, { nowMs, month, week });

          const isLifetime = quest.type === 'lifetime_milestone' || quest.period === 'lifetime';
          const isWeekly = !isLifetime && (quest.period === 'week' || quest.period === 'weekly' || quest.perWeek != null);
          const counters = isLifetime ? (p.counters?.lifetime || {}) : (isWeekly ? weekCounters : monthCounters);
          const limit = isLifetime ? 1 : (isWeekly ? (quest.perWeek ?? quest.limit ?? quest.perMonth ?? 1) : (quest.perMonth ?? quest.limit ?? 1));
          const count = isLifetime ? Math.max(counters[quest.id] || 0, p.stats?.quests?.[quest.id] || 0) : (counters[quest.id] || 0);
          const isDone = count >= limit;

          let progress = 0; let target = limit; let percent = 0;
          if (isDone) {
            percent = 100;
          } else {
            try {
              const val = validateQuest(p, quest, { nowMs, month, week });
              progress = val.progress ?? 0;
              target = val.target ?? limit;
              percent = val.percent ?? 0;
            } catch {
              progress = isLifetime ? (p.earned || 0) : count;
              target = quest.target ?? limit;
              percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
            }
          }
          const fmtProg = Number.isInteger(progress) ? progress : Number(progress).toFixed(1);
          const fmtTar = Number.isInteger(target) ? target : Number(target).toFixed(1);

          let desc = quest.desc || quest.description;
          if (!desc) {
            if (quest.type === 'weekly_count' || quest.type === 'grade_count') desc = 'Отримай 4 оцінки протягом тижня';
            else if (quest.type === 'consecutive') desc = '3 оцінки від 7 балів поспіль';
            else if (quest.type === 'target_grade' || quest.type === 'grade') desc = 'Отримай оцінку 12';
            else if (quest.type === 'monthly_growth') desc = 'Підвищ середній бал порівняно з минулим місяцем';
            else if (quest.type === 'monthly_average') desc = 'Середній бал понад 10 протягом місяця';
            else if (quest.type === 'growth') desc = 'Отримай оцінку, вищу за середній бал твоїх робіт';
            else if (quest.type === 'streak') desc = '3 оцінки від 8 балів протягом 7 днів';
            else if (quest.type === 'lifetime_milestone') desc = `Назбирай ${quest.target ?? 100} зірочок за весь час`;
            else if (quest.type === 'manual') desc = 'Корисна допомога класу або спільній справі';
            else desc = 'Спеціальне завдання';
          }

          // Підбір векторної іконки
          let iconHtml = '';
          if (quest.type === 'streak') iconHtml = iconFlame(26);
          else if (quest.type === 'growth') iconHtml = iconGrowth(26);
          else if (quest.type === 'manual') iconHtml = iconContrib(26);
          else iconHtml = `<span style="font-size: 24px;">${quest.icon || '🏆'}</span>`;

          const periodText = isLifetime ? 'за весь час' : (isWeekly ? 'цього тижня' : 'цього місяця');

          const baseCardContent = `
            <div class="parchment-card" style="padding: 14px 16px;">
              <div class="flex justify-between items-start" style="gap: 8px;">
                <div class="flex items-start gap-sm">
                  <!-- Круглий золотий медальйон з іконкою -->
                  <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: radial-gradient(circle, #f9eed7 0%, #e8d2a7 100%); border: 1.5px solid var(--gold-deep); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.15);">
                    ${iconHtml}
                  </div>
                  <div>
                    <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment); margin-bottom: 2px;">
                      ${quest.title || quest.name}
                    </div>
                    <div style="font-size: 12px; color: var(--text-parchment-muted); line-height: 1.35; max-width: 250px;">
                      ${desc}
                    </div>
                  </div>
                </div>

                <!-- Золотий бейдж нагороди +3 ✦ -->
                <div class="badge-gold" style="flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font-size: 14px; padding: 4px 10px; border-radius: 14px;">
                  +${quest.reward} ✦
                </div>
              </div>

              <!-- Прогрес виконання -->
              <div style="margin-top: 10px;">
                <div class="flex justify-between" style="font-size: 11px; margin-bottom: 4px; color: var(--text-parchment-subtle);">
                  <span>${isDone ? 'Виконано ✓' : `Прогрес ${periodText}:`}</span>
                  <span style="font-weight: 700; color: var(--text-parchment);">${isDone ? "Виконано" : (fmtProg + " / " + fmtTar)}</span>
                </div>
                <div class="genshin-progress-track">
                  <div class="${isDone ? 'genshin-progress-fill-cyan' : 'genshin-progress-fill-gold'}" style="width: ${percent}%;"></div>
                </div>
              </div>
            </div>
          `;

          // Якщо на квесті лежить динамічний туман (fog)
          if (secretState.state === 'fog') {
            return `
              <div class="quest-fog-container">
                <div class="quest-fog-overlay fog-${secretState.stage}">
                  <div style="font-size: 20px; margin-bottom: 2px;">🔮</div>
                  <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${secretState.stage === 'white' ? 'Простір вібрує...' : (secretState.stage === 'twilight' ? 'Астральний туман згущується...' : 'Майже розвіяно!')}
                  </div>
                  <div style="font-size: 11px; margin-top: 3px; opacity: 0.9;">
                    Розвіювання туману: <b>${secretState.current} / ${secretState.target}</b>
                  </div>
                </div>
                ${baseCardContent}
              </div>
            `;
          }

          return baseCardContent;
        }).join('')}
      </div>
    </div>
  `;
}

