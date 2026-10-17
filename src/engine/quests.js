import { kyivParts } from './time.js';
import { bump, snapshot } from './utils.js';
import {
  countWeeklyGrades,
  calculateStreak,
  calculatePeriodAverage,
  normalizeGrades
} from './economy.js';

function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Отримання ключа попереднього місяця у форматі YYMM (наприклад '2610' -> '2609', '2601' -> '2512').
 * @param {string} monthKey
 * @returns {string|null}
 */
export function getPreviousMonthKey(monthKey) {
  if (!monthKey || typeof monthKey !== 'string' || monthKey.length < 4) return null;
  const yy = parseInt(monthKey.slice(0, 2), 10);
  const mm = parseInt(monthKey.slice(2, 4), 10);
  if (isNaN(yy) || isNaN(mm)) return null;
  let prevY = yy;
  let prevM = mm - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY = yy - 1;
  }
  return String(prevY).padStart(2, '0') + String(prevM).padStart(2, '0');
}

/**
 * Витягує список оцінок учня з профілю або контексту.
 * @param {object} p Профіль учня
 * @param {number|null} [fallbackGrade]
 * @param {number|null} [fallbackMs]
 * @returns {Array}
 */
export function getProfileGradeItems(p, fallbackGrade = null, fallbackMs = null) {
  let items = [];
  if (Array.isArray(p.grades) && p.grades.length > 0) {
    items = p.grades;
  } else if (Array.isArray(p.ledger) && p.ledger.length > 0) {
    items = p.ledger;
  } else if (Array.isArray(p.history) && p.history.length > 0) {
    items = p.history;
  } else if (Array.isArray(p.recent) && p.recent.length > 0) {
    items = p.recent.map((g, idx) => {
      if (typeof g === 'number') {
        return { grade: g, ts: null, order: idx };
      }
      return { ...g, ts: g.ts ?? null };
    });
  }
  return items;
}

/**
 * Чиста функція валідації квесту для перевірки прогресу учня у відповідному вікні часу (weekly/monthly).
 *
 * @param {object} p Профіль учня
 * @param {object} q Об'єкт конфігурації квесту
 * @param {object|number} [contextOrMs] Контекст або timestamp
 * @returns {{ eligible: boolean, progress: number, target: number, current: number, completed: boolean, limit: number, timesAwarded: number, limitReached: boolean, isWeekly: boolean, periodKey: string, percent: number }}
 */
export function validateQuest(p, q, contextOrMs = {}) {
  const context = typeof contextOrMs === 'number' ? { nowMs: contextOrMs } : (contextOrMs || {});
  const nowMs = context.nowMs ?? Date.now();
  const parts = kyivParts(nowMs);
  const targetMonth = context.month ?? parts.month;
  const targetWeek = context.week ?? parts.week;
  const targetDay = context.day ?? parts.day;
  const g = context.g ?? null;

  const isLifetime = q.type === 'lifetime_milestone' || q.period === 'lifetime';
  const isDaily = q.period === 'daily';
  const isWeekly = !isLifetime && !isDaily && (q.period === 'weekly' || q.period === 'week' || q.perWeek != null);
  const periodKey = isLifetime ? 'lifetime' : (isDaily ? parts.ymd : (isWeekly ? targetWeek : targetMonth));
  const limit = isLifetime ? 1 : (isDaily ? (q.limit ?? 1) : (isWeekly ? (q.perWeek ?? q.limit ?? 1) : (q.perMonth ?? q.limit ?? 1)));
  const counters = (p.counters && p.counters[periodKey]) || {};
  const timesAwarded = isLifetime ? Math.max(counters[q.id] || 0, p.stats?.quests?.[q.id] || 0) : (counters[q.id] || 0);
  const isLimitReached = timesAwarded >= limit;

  // Нормалізовані оцінки учня
  const rawItems = context.items || getProfileGradeItems(p, g, null);
  const items = normalizeGrades(rawItems);

  let eligible = false;
  let progress = 0;
  let target = 1;
  let customPercent = null;

  switch (q.type) {
    case 'daily_hot': {
      const todayYmd = parts.ymd;
      const dayCounters = p.counters?.[todayYmd] || {};
      progress = dayCounters.gradeCount ? 1 : (g != null ? 1 : 0);
      target = 1;
      eligible = progress >= target;
      break;
    }

    case 'weekly_count':
    case 'grade_count': {
      target = q.params?.count ?? q.params?.targetCount ?? 4;
      const counterCount = p.counters?.[targetWeek]?.gradeCount ?? 0;
      const weeklyCount = countWeeklyGrades(items, targetWeek);
      const effectiveCount = Math.max(counterCount, weeklyCount > 0 ? weeklyCount : (items.length > 0 && items.every(i => i.ts == null) ? items.length : 0));
      progress = effectiveCount;
      eligible = effectiveCount >= target;
      break;
    }

    case 'consecutive': {
      const minGrade = q.params?.minGrade ?? 7;
      target = q.params?.length ?? q.params?.targetLength ?? 3;
      const streakItems = (Array.isArray(p.recent) && p.recent.length > 0) ? p.recent : items;
      const streak = calculateStreak(streakItems, minGrade, target);
      progress = streak.current;
      eligible = streak.current >= target || streak.qualifies;
      break;
    }

    case 'streak': {
      if (q.params?.windowDays != null) {
        // Застарілий формат streak з вікном у днях (E8/E9)
        const hot = (p.hot || []).filter(d => targetDay - d < q.params.windowDays);
        progress = hot.length;
        target = q.params.length ?? 3;
        eligible = (g != null && g >= (q.params.minGrade ?? 8)) && (progress + 1 >= target);
      } else {
        const minGrade = q.params?.minGrade ?? 7;
        target = q.params?.length ?? q.params?.targetLength ?? 3;
        const streak = calculateStreak(items, minGrade, target);
        progress = streak.current;
        eligible = streak.current >= target || streak.qualifies;
      }
      break;
    }

    case 'target_grade':
    case 'grade':
    case 'score': {
      const reqGrade = q.params?.grade ?? q.params?.exactGrade ?? q.params?.minGrade ?? 12;
      if (q.params?.targetCount != null) {
        target = q.params.targetCount;
        let count12 = 0;
        for (const item of items) {
          if (item.grade === reqGrade && item.ts != null) {
            if (kyivParts(item.ts).week === targetWeek) count12++;
          }
        }
        progress = count12;
        eligible = progress >= target;
      } else {
        target = limit;
        progress = timesAwarded;
        eligible = g != null && g === reqGrade && timesAwarded < limit;
      }
      break;
    }

    case 'monthly_growth':
    case 'period_growth': {
      const minTotal = q.params?.minTotalGrades ?? 10;
      const mCurr = p.counters?.[targetMonth];
      const prevMonth = getPreviousMonthKey(targetMonth);
      const mPrev = prevMonth ? p.counters?.[prevMonth] : null;
      let currStats, prevStats, totalGrades;

      const statsTotal = Object.values(p.stats?.gradeCount || {}).reduce((a, b) => a + b, 0);
      totalGrades = Math.max(items.length, statsTotal, (mCurr?.gradeCount || 0) + (mPrev?.gradeCount || 0));

      if (mCurr && typeof mCurr.gradeCount === 'number' && mPrev && typeof mPrev.gradeCount === 'number' && mPrev.gradeCount > 0) {
        currStats = { average: Math.round((mCurr.gradeSum / mCurr.gradeCount) * 10) / 10, count: mCurr.gradeCount, hasData: true };
        prevStats = { average: Math.round((mPrev.gradeSum / mPrev.gradeCount) * 10) / 10, count: mPrev.gradeCount, hasData: true };
      } else {
        currStats = calculatePeriodAverage(items, { targetMonth: targetMonth });
        if (!currStats.hasData && mCurr && typeof mCurr.gradeCount === 'number' && mCurr.gradeCount > 0) {
          currStats = { average: Math.round((mCurr.gradeSum / mCurr.gradeCount) * 10) / 10, count: mCurr.gradeCount, hasData: true };
        }
        prevStats = calculatePeriodAverage(items, { targetMonth: prevMonth });
        if (!prevStats.hasData && mPrev && typeof mPrev.gradeCount === 'number' && mPrev.gradeCount > 0) {
          prevStats = { average: Math.round((mPrev.gradeSum / mPrev.gradeCount) * 10) / 10, count: mPrev.gradeCount, hasData: true };
        }
      }

      progress = totalGrades;
      target = minTotal;
      if (totalGrades >= minTotal && currStats.hasData && prevStats.hasData && prevStats.count > 0) {
        eligible = currStats.average > prevStats.average;
        progress = currStats.average;
        target = prevStats.average;
      }
      break;
    }

    case 'monthly_average':
    case 'period_average': {
      const minAvg = q.params?.minAverage ?? 10;
      target = minAvg;
      const mCounter = p.counters?.[targetMonth];
      let currStats;
      if (mCounter && typeof mCounter.gradeCount === 'number' && mCounter.gradeCount > 0) {
        const avg = Math.round((mCounter.gradeSum / mCounter.gradeCount) * 10) / 10;
        currStats = { average: avg, count: mCounter.gradeCount, hasData: true };
      } else {
        currStats = calculatePeriodAverage(items, { targetMonth: targetMonth });
      }
      progress = currStats.average;
      const minGrades = q.params?.minMonthlyGrades;
      const count = currStats.hasData ? (currStats.count || 0) : 0;
      if (minGrades != null && count < minGrades) {
        eligible = false;
        customPercent = Math.min(99, Math.floor((count / minGrades) * 100));
      } else {
        eligible = currStats.hasData && count >= (minGrades ?? 1) && (minGrades != null ? currStats.average >= minAvg : currStats.average > minAvg);
      }
      break;
    }

    case 'growth': {
      const { window = 10, minHistory = 5, delta = 2, minGrade = 7 } = q.params || {};
      const prevRecent = (p.recent && p.recent.length > 0 && p.recent[p.recent.length - 1] === g)
        ? p.recent.slice(0, -1)
        : (p.recent || []);
      const base = avg(prevRecent.slice(-window));
      progress = prevRecent.length;
      target = minHistory;
      eligible = prevRecent.length >= minHistory && g != null && g >= minGrade && g >= base + delta;
      break;
    }

    case 'lifetime_milestone': {
      target = q.target ?? q.params?.target ?? 100;
      progress = p.earned || 0;
      eligible = progress >= target;
      break;
    }

    default:
      eligible = false;
      break;
  }

  const percent = customPercent !== null
    ? customPercent
    : (target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : (eligible ? 100 : 0));

  return {
    eligible,
    progress,
    target,
    current: progress,
    completed: eligible,
    timesAwarded,
    limit,
    limitReached: isLimitReached,
    isWeekly,
    isLifetime,
    isDaily,
    periodKey,
    percent
  };
}

export function runQuests(p, g, cfg, month, day, events, week, nowMs) {
  let bonus = 0;
  const currentMs = nowMs ?? Date.now();
  const quests = (cfg.quests || []).filter(q => q.active !== false);

  for (const q of quests) {
    if (q.type === 'manual') continue;

    // Якщо це секретний квест, перевіряємо чи він розблокований
    if (q.secret) {
      const secState = getQuestSecretState(p, q, quests, {
        g,
        nowMs: currentMs,
        month,
        day,
        week
      });
      if (secState.isLocked) {
        continue;
      }
    }

    // Сумісність: старий streak з p.hot
    if (q.type === 'streak' && q.params?.windowDays != null) {
      if (g >= q.params.minGrade) {
        p.hot = [...(p.hot || []).filter(d => day - d < q.params.windowDays), day];
        if (p.hot.length >= q.params.length) {
          p.hot = [];
          bonus += award(p, q, cfg, month, events, week, currentMs);
        }
      }
      continue;
    }

    // Сумісність: старий growth з p.recent (базовий бал розраховується до додавання g)
    if (q.type === 'growth') {
      const { window = 10, minHistory = 5, delta = 2, minGrade = 7 } = q.params || {};
      const prevRecent = (p.recent && p.recent.length > 0 && p.recent[p.recent.length - 1] === g)
        ? p.recent.slice(0, -1)
        : (p.recent || []);
      const base = avg(prevRecent.slice(-window));
      if (prevRecent.length >= minHistory && g >= minGrade && g >= base + delta) {
        bonus += award(p, q, cfg, month, events, week, currentMs);
      }
      continue;
    }

    // Валідація нових типів квестів
    const validation = validateQuest(p, q, {
      g,
      nowMs: currentMs,
      month,
      day,
      week
    });

    if (validation.eligible) {
      bonus += award(p, q, cfg, month, events, week, currentMs);
    }
  }

  // Оновлення p.recent для сумісності з growth (якщо не було додано в creditGrades)
  const growthQuests = quests.filter(q => q.type === 'growth');
  const maxWindow = growthQuests.length > 0 ? Math.max(...growthQuests.map(q => q.params.window || 10)) : 10;
  if (!p.recent || p.recent[p.recent.length - 1] !== g) {
    p.recent = [...(p.recent || []), g].slice(-Math.max(maxWindow, 10));
  }

  return bonus;
}

/** Нарахування квесту з урахуванням лімітів; повертає нараховану кількість ✦. Використовується і для manual-квестів. */
export function award(p, q, cfg, month, events, week, nowMs) {
  const isLifetime = q.type === 'lifetime_milestone' || q.period === 'lifetime';
  const isDaily = q.period === 'daily';
  const isWeekly = !isLifetime && !isDaily && (q.period === 'week' || q.period === 'weekly' || q.perWeek != null);

  const currentKyiv = kyivParts(nowMs ?? Date.now());
  let periodKey = month;
  if (isLifetime) periodKey = 'lifetime';
  else if (isDaily) periodKey = currentKyiv.ymd;
  else if (isWeekly) periodKey = week || currentKyiv.week;

  const limit = isLifetime ? 1 : (isDaily ? (q.limit ?? 1) : (isWeekly ? (q.perWeek ?? q.limit ?? 1) : (q.perMonth ?? q.limit ?? 1)));

  const cap = isLifetime || isDaily ? Infinity : (isWeekly ? (cfg.questWeeklyCap ?? Infinity) : (cfg.questMonthlyCap ?? Infinity));

  if (!p.counters) p.counters = {};
  const c = (p.counters[periodKey] ??= {});
  const timesAwarded = isLifetime ? Math.max(c[q.id] ?? 0, p.stats?.quests?.[q.id] ?? 0) : (c[q.id] ?? 0);
  if (timesAwarded >= limit) return 0;
  const give = isFinite(cap) ? Math.min(q.reward, Math.max(cap - (c.questStars ?? 0), 0)) : q.reward;
  if (give <= 0) return 0;
  c[q.id] = (c[q.id] ?? 0) + 1;
  if (!isLifetime && !isDaily) {
    c.questStars = (c.questStars ?? 0) + give;
  }
  p.balance += give; p.earned += give;
  bump(p.stats.quests, q.id);
  events.push({ quest: q.id, delta: give });
  return give;
}

/** Ручний квест («Внесок»): повертає Result з delta, prev, events. */
export function awardManual(p, questId, cfg, nowMs) {
  const q = cfg.quests.find(x => x.id === questId && x.type === 'manual');
  if (!q || !q.active) return { ok: false, reason: 'invalid-quest' };

  const { month, week } = kyivParts(nowMs);
  const next = structuredClone(p);
  const prev = snapshot(p);
  const events = [];

  const give = award(next, q, cfg, month, events, week, nowMs);
  if (give === 0) return { ok: false, reason: 'limit' };

  return { ok: true, profile: next, delta: give, prev, events };
}

/**
 * Розраховує прогрес розкриття для пари батьківський квест -> секретний квест.
 */
function getRevealProgress(p, parentQuest, secretQuest, ctx, items, targetWeek, targetMonth) {
  let revealCurrent = 0;
  let baseTarget = 1;

  if (parentQuest.type === 'weekly_count' || parentQuest.type === 'grade_count') {
    baseTarget = parentQuest.params?.count ?? parentQuest.params?.targetCount ?? 4;
    const counterCount = p.counters?.[targetWeek]?.gradeCount ?? 0;
    const weeklyCount = countWeeklyGrades(items, targetWeek);
    revealCurrent = Math.max(counterCount, weeklyCount > 0 ? weeklyCount : (items.length > 0 && items.every(i => i.ts == null) ? items.length : 0));
  } else if (parentQuest.type === 'consecutive') {
    const minGrade = parentQuest.params?.minGrade ?? 7;
    baseTarget = parentQuest.params?.length ?? parentQuest.params?.targetLength ?? 3;
    const streakItems = (Array.isArray(p.recent) && p.recent.length > 0) ? p.recent : items;
    const streak = calculateStreak(streakItems, minGrade, baseTarget);
    revealCurrent = streak.current;
  } else if (parentQuest.type === 'target_grade' || parentQuest.type === 'grade') {
    const targetGrade = parentQuest.params?.grade ?? 12;
    baseTarget = parentQuest.perWeek ?? parentQuest.limit ?? 2;
    let countGrade = 0;
    for (const item of items) {
      if (item.grade === targetGrade && item.ts != null) {
        if (kyivParts(item.ts).week === targetWeek) countGrade++;
      }
    }
    const awarded = p.counters?.[targetWeek]?.[parentQuest.id] ?? p.counters?.[targetWeek]?.['brilliant_result'] ?? 0;
    revealCurrent = Math.max(countGrade, awarded);
  } else if (parentQuest.type === 'monthly_average' || parentQuest.type === 'period_average') {
    baseTarget = parentQuest.params?.minAverage ?? 10;
    const mCounter = p.counters?.[targetMonth];
    let avgVal = 0;
    if (mCounter && typeof mCounter.gradeCount === 'number' && mCounter.gradeCount > 0) {
      avgVal = Math.round((mCounter.gradeSum / mCounter.gradeCount) * 10) / 10;
    } else {
      const stats = calculatePeriodAverage(items, { targetMonth });
      avgVal = stats.hasData ? stats.average : 0;
    }
    revealCurrent = avgVal;
  } else {
    const val = validateQuest(p, parentQuest, ctx);
    baseTarget = val.target;
    revealCurrent = val.progress;
  }

  return { revealCurrent, baseTarget };
}

/**
 * Визначає стан секретності та туману для квесту.
 * @param {object} p Профіль учня
 * @param {object} quest Цільовий квест
 * @param {Array} allQuests Масив усіх квестів конфігурації
 * @param {object|number} [context] Контекст (nowMs, week, month тощо)
 * @returns {object} Стан квесту
 */
export function getQuestSecretState(p, quest, allQuests = [], context = {}) {
  const ctx = typeof context === 'number' ? { nowMs: context } : (context || {});
  const nowMs = ctx.nowMs ?? Date.now();
  const parts = kyivParts(nowMs);
  const targetMonth = ctx.month ?? parts.month;
  const targetWeek = ctx.week ?? parts.week;

  const rawItems = ctx.items || getProfileGradeItems(p, ctx.g ?? null, null);
  const items = normalizeGrades(rawItems);

  // 1. Якщо це секретний квест (q.secret або має parentQuestId)
  if (quest.secret || quest.parentQuestId) {
    const parent = allQuests.find(q => q.id === quest.parentQuestId);
    const unlockAt = quest.unlockAt ?? 0;
    let revealCurrent = 0;
    let isParentDone = true;

    if (parent) {
      const prog = getRevealProgress(p, parent, quest, ctx, items, targetWeek, targetMonth);
      revealCurrent = prog.revealCurrent;
      const parentVal = validateQuest(p, parent, ctx);
      isParentDone = parentVal.completed || parentVal.limitReached || (parentVal.timesAwarded >= parentVal.limit) || (prog.revealCurrent >= prog.baseTarget);
    } else {
      const val = validateQuest(p, quest, ctx);
      revealCurrent = val.progress;
    }

    if (!isParentDone || revealCurrent < unlockAt) {
      return {
        isLocked: true,
        isRevealed: false,
        current: revealCurrent,
        target: unlockAt
      };
    }

    return {
      isLocked: false,
      isRevealed: true,
      current: revealCurrent,
      target: unlockAt,
      val: validateQuest(p, quest, ctx)
    };
  }

  // 2. Якщо це звичайний квест з секретним супутником sq
  const sq = allQuests.find(q => q.parentQuestId === quest.id);
  if (sq) {
    const { revealCurrent, baseTarget } = getRevealProgress(p, quest, sq, ctx, items, targetWeek, targetMonth);
    const revealTarget = sq.unlockAt;
    const baseVal = validateQuest(p, quest, ctx);
    const isDone = baseVal.completed || baseVal.limitReached || (baseVal.timesAwarded >= baseVal.limit) || (revealCurrent >= baseTarget);

    if (revealCurrent >= revealTarget) {
      return {
        state: 'awakened',
        current: revealCurrent,
        target: revealTarget,
        secretQuest: sq
      };
    }

    if (isDone && revealCurrent >= baseTarget && revealCurrent < revealTarget) {
      let stage = 'white';
      if (Number.isInteger(baseTarget)) {
        if (revealCurrent <= baseTarget) {
          stage = 'white';
        } else if (revealCurrent === baseTarget + 1) {
          stage = 'twilight';
        } else {
          stage = 'abyss';
        }
      } else {
        const delta = (revealTarget - baseTarget) / 3;
        if (revealCurrent <= baseTarget + delta) {
          stage = 'white';
        } else if (revealCurrent <= baseTarget + delta * 2) {
          stage = 'twilight';
        } else {
          stage = 'abyss';
        }
      }

      return {
        state: 'fog',
        stage,
        current: revealCurrent,
        target: revealTarget,
        secretQuest: sq
      };
    }

    return {
      state: 'normal',
      current: revealCurrent,
      target: revealTarget,
      secretQuest: sq
    };
  }

  return { state: 'none' };
}

/**
 * Знаходить один незакритий квест з найвищим відсотком завершення для дашборду учня.
 * @param {object} p Профіль учня
 * @param {object} cfg Конфігурація системи (квести, ліміти)
 * @param {number} [nowMs] Поточний час
 * @returns {object|null}
 */
export function findNearestQuest(p, cfg, nowMs = Date.now()) {
  const quests = (cfg?.quests || (typeof window !== 'undefined' && window.zklas?.config?.quests) || []).filter(q => q.active !== false);
  if (!quests.length) return null;

  const { month, week } = kyivParts(nowMs);
  const weekCounters = (p?.counters && p.counters[week]) || {};
  const monthCounters = (p?.counters && p.counters[month]) || {};
  const lifetimeCounters = (p?.counters && p.counters['lifetime']) || {};

  const candidates = [];

  for (const q of quests) {
    if (q.secret) {
      const secState = getQuestSecretState(p, q, quests, { nowMs, month, week });
      if (secState.isLocked) {
        continue;
      }
    }

    const isLifetime = q.type === 'lifetime_milestone' || q.period === 'lifetime';
    const isDaily = q.period === 'daily';
    const isWeekly = !isLifetime && !isDaily && (q.period === 'week' || q.period === 'weekly' || q.perWeek != null);
    const counters = isLifetime ? lifetimeCounters : (isWeekly ? weekCounters : (isDaily ? (p?.counters?.[kyivParts(nowMs).ymd] || {}) : monthCounters));
    const limit = isLifetime ? 1 : (isDaily ? (q.limit ?? 1) : (isWeekly ? (q.perWeek ?? q.limit ?? q.perMonth ?? 1) : (q.perMonth ?? q.limit ?? 1)));
    const timesAwarded = isLifetime ? Math.max(counters[q.id] || 0, p?.stats?.quests?.[q.id] || 0) : (counters[q.id] || 0);

    // Якщо ліміт квесту вичерпано — квест закритий
    if (timesAwarded >= limit) {
      continue;
    }

    let progress = 0;
    let target = 1;
    let percent = 0;

    try {
      const val = validateQuest(p, q, { nowMs, month, week });
      progress = val.progress ?? 0;
      target = val.target ?? 1;
      percent = val.percent ?? 0;
    } catch {
      progress = isLifetime ? (p?.earned || 0) : (counters[q.id] || 0);
      target = isLifetime ? (q.target ?? 100) : limit;
      percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
    }

    if (percent >= 100) continue;

    const isPassive = q.type === 'monthly_average' || q.type === 'period_average' || q.type === 'growth' || q.type === 'monthly_growth' || q.type === 'lifetime_milestone';
    const priority = q.secret ? 2 : (isPassive ? 0 : 1);

    let desc = q.desc || q.description;
    if (!desc) {
      if (q.type === 'weekly_count' || q.type === 'grade_count') desc = 'Отримай 4 оцінки протягом тижня';
      else if (q.type === 'consecutive') desc = '3 оцінки від 7 балів поспіль';
      else if (q.type === 'target_grade' || q.type === 'grade') desc = 'Отримай оцінку 12';
      else if (q.type === 'monthly_growth') desc = 'Підвищ середній бал порівняно з минулим місяцем';
      else if (q.type === 'monthly_average') desc = 'Середній бал понад 10 протягом місяця';
      else if (q.type === 'growth') desc = 'Отримай оцінку, вищу за середній бал твоїх робіт';
      else if (q.type === 'streak') desc = '3 оцінки від 8 балів протягом 7 днів';
      else if (q.type === 'lifetime_milestone') desc = `Назбирай ${q.target ?? 100} зірочок за весь час`;
      else if (q.type === 'daily_hot') desc = 'Зарахуй оцінку в той самий день, коли її отримано';
      else if (q.type === 'manual') desc = 'Корисна допомога класу або спільній справі';
      else desc = 'Спеціальне завдання';
    }

    candidates.push({
      quest: q,
      progress,
      target,
      percent,
      priority,
      desc,
      reward: q.reward || 0,
      isWeekly,
      isLifetime,
      isDaily,
      isSecret: !!q.secret,
      overdrive: !!q.overdrive
    });
  }

  if (candidates.length === 0) return null;

  // Обираємо квест з найвищим відсотком завершення (якщо однакові: за прогресом або нагородою)
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (b.percent !== a.percent) return b.percent - a.percent;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.reward - a.reward;
  });

  return candidates[0];
}
