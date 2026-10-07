import { kyivParts } from './time.js';
import { bump, snapshot } from './utils.js';
import { runQuests } from './quests.js';

/**
 * @typedef {import('./utils.js').ProfileState} ProfileState
 */

/**
 * @param {ProfileState} p  поточний стан
 * @param {number[]} grades оцінки в порядку, у якому їх тапнув вчитель
 * @param {object} cfg конфігурація
 * @param {number} nowMs поточний час
 * @returns {{profile:ProfileState, entries:{g:number,v:number}[], events:object[], delta:number, prev:object}}
 */
export function creditGrades(p, grades, cfg, nowMs) {
  const { month, day } = kyivParts(nowMs);
  const next = structuredClone(p);
  const events = [];
  const entries = [];
  const prev = snapshot(p);
  let delta = 0;
  for (const g of grades) {
    if (!(String(g) in cfg.grades)) throw new Error(`grade-not-allowed:${g}`);
    const v = cfg.grades[g];
    next.balance += v; next.earned += v; delta += v;
    bump(next.stats.gradeCount, g);
    entries.push({ g, v });
    delta += runQuests(next, g, cfg, month, day, events);
  }
  next.last = { t: nowMs, gs: [...grades] };
  return { profile: next, entries, events, delta, prev };
}

/** Чи схоже на повторне зарахування (м'яке застереження, не блокування). */
export const isRepeat = (p, grades, cfg, nowMs) =>
  !!p.last && nowMs - p.last.t < cfg.settings.dupWindowMin * 60000 && grades.some(g => p.last.gs.includes(g));
