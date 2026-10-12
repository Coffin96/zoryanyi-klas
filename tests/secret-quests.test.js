import { test, describe } from 'node:test';
import assert from 'node:assert';
import { kyivParts } from '../src/engine/time.js';
import { creditGrades } from '../src/engine/economy.js';
import { defaultConfig } from '../src/data/default-config.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  validateQuest, 
  award, 
  getQuestSecretState, 
  findNearestQuest 
} from '../src/engine/quests.js';
import { renderQuests, getDisplayQuests } from '../src/student/quests.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emptyProfile = () => ({
  balance: 0,
  earned: 0,
  recent: [],
  grades: [],
  hot: [],
  last: null,
  lastOp: null,
  lastAt: {},
  stats: { gradeCount: {}, quests: {}, redeemed: {} },
  counters: {},
  achievements: []
});

describe('Secret Quests & Solo Leveling Overdrive System (Stage B)', () => {
  const cfg = structuredClone(defaultConfig);
  const allQuests = cfg.quests;
  const knowledgeQuest = allQuests.find(q => q.id === 'knowledge_gatherer');
  const secretOverdrive = allQuests.find(q => q.id === 'secret_academic_overdrive');
  const dailyHotQuest = allQuests.find(q => q.id === 'secret_daily_hot');

  describe('1. Стадії динамічного туману (Dynamic Fog stages)', () => {
    const t = Date.parse('2026-10-12T10:00:00Z');
    const { week } = kyivParts(t);

    test('getQuestSecretState при 4 оцінках повертає white', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 4 };

      const state = getQuestSecretState(p, knowledgeQuest, allQuests, { nowMs: t });
      assert.strictEqual(state.state, 'fog');
      assert.strictEqual(state.stage, 'white');
      assert.strictEqual(state.current, 4);
      assert.strictEqual(state.target, 7);
    });

    test('getQuestSecretState при 5 оцінках повертає twilight', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 5 };

      const state = getQuestSecretState(p, knowledgeQuest, allQuests, { nowMs: t });
      assert.strictEqual(state.state, 'fog');
      assert.strictEqual(state.stage, 'twilight');
      assert.strictEqual(state.current, 5);
      assert.strictEqual(state.target, 7);
    });

    test('getQuestSecretState при 6 оцінках повертає abyss', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 6 };

      const state = getQuestSecretState(p, knowledgeQuest, allQuests, { nowMs: t });
      assert.strictEqual(state.state, 'fog');
      assert.strictEqual(state.stage, 'abyss');
      assert.strictEqual(state.current, 6);
      assert.strictEqual(state.target, 7);
    });

    test('getQuestSecretState при 7 оцінках повертає awakened', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 7 };

      const state = getQuestSecretState(p, knowledgeQuest, allQuests, { nowMs: t });
      assert.strictEqual(state.state, 'awakened');
      assert.strictEqual(state.current, 7);
      assert.strictEqual(state.target, 7);
    });
  });

  describe('2. Пробудження та розкриття секретного квесту при досягненні unlockAt', () => {
    const t = Date.parse('2026-10-12T10:00:00Z');
    const { week } = kyivParts(t);

    test('До завершення батьківського квесту (2 оцінки при цілі 4) секретний квест заблокований', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 2 };

      const secState = getQuestSecretState(p, secretOverdrive, allQuests, { nowMs: t });
      assert.strictEqual(secState.isLocked, true);
      assert.strictEqual(secState.isRevealed, false);
    });

    test('При менше ніж unlockAt (6 оцінок) секретний квест заблокований', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 6 };

      const secState = getQuestSecretState(p, secretOverdrive, allQuests, { nowMs: t });
      assert.strictEqual(secState.isLocked, true);
      assert.strictEqual(secState.isRevealed, false);
    });

    test('При досягненні unlockAt (7 оцінок) секретний квест розблоковано та пробуджено', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 7 };

      const secState = getQuestSecretState(p, secretOverdrive, allQuests, { nowMs: t });
      assert.strictEqual(secState.isLocked, false);
      assert.strictEqual(secState.isRevealed, true);
      assert.ok(secState.val);
      assert.strictEqual(secState.val.progress, 7);
      assert.strictEqual(secState.val.target, 10);
      assert.strictEqual(secState.val.eligible, false); // ще треба 10 для виконання
    });
  });

  describe('3. Виконання секретного квесту: при 10 оцінках нараховує +3 ✦', () => {
    const t = Date.parse('2026-10-12T10:00:00Z');

    test('При отриманні 10 оцінок за тиждень secret_academic_overdrive нараховує +3 ✦', () => {
      let p = emptyProfile();
      // Зараховуємо перші 9 оцінок (по 10 балів)
      let res = creditGrades(p, [10, 10, 10, 10, 10, 10, 10, 10, 10], cfg, t);
      p = res.profile;

      // 10-та оцінка
      res = creditGrades(p, [10], cfg, t + 1000);
      p = res.profile;

      const overdriveEvent = res.events.find(e => e.quest === 'secret_academic_overdrive');
      assert.ok(overdriveEvent, 'Подія секретного квесту повинна спрацювати');
      assert.strictEqual(overdriveEvent.delta, 3, 'Нагорода за Академічний штурм повинна складати 3 ✦');
    });
  });

  describe('4. Буфер Овердрайву (Quest Overdrive Buffer)', () => {
    const t = Date.parse('2026-10-12T10:00:00Z');
    const { week, month } = kyivParts(t);

    test('Оскільки капи знято (questWeeklyCap: 999), і звичайний квест «Збирач знань» (+2 ✦), і секретний «Академічний штурм» (+3 ✦) нараховуються безперешкодно у повному обсязі', () => {
      const p = emptyProfile();
      p.counters[week] = { questStars: 15, gradeCount: 9 };

      const events = [];
      // Звичайний тижневий квест з нагородою 2 ✦
      const normalDelta = award(p, knowledgeQuest, cfg, month, events, week, t);
      assert.strictEqual(normalDelta, 2, 'Звичайний квест повинен нараховуватися у повному обсязі (+2 ✦)');

      // Секретний овердрайв-квест з нагородою 3 ✦
      const secretDelta = award(p, secretOverdrive, cfg, month, events, week, t);
      assert.strictEqual(secretDelta, 3, 'Секретний овердрайв повинен нараховуватися у повному обсязі (+3 ✦)');
      assert.strictEqual(p.counters[week].questStars, 20, 'Загальна сума зірок за тиждень повинна зрости до 20 (15 + 2 + 3)');
    });
  });

  describe('5. Щоденний квест «Гарячий щоденник» (daily_hot)', () => {
    const t = Date.parse('2026-10-12T10:00:00Z');
    const { ymd } = kyivParts(t);

    test('Коректно нагороджує 1 ✦ при нарахуванні в день отримання оцінки', () => {
      const p = emptyProfile();
      const res = creditGrades(p, [11], cfg, t);

      const hotEvent = res.events.find(e => e.quest === 'secret_daily_hot');
      assert.ok(hotEvent, 'Подія Гарячий щоденник повинна спрацювати');
      assert.strictEqual(hotEvent.delta, 1);
      assert.strictEqual(res.profile.counters[ymd]['secret_daily_hot'], 1);
    });

    test('Повторна оцінка в той самий день не нараховує Гарячий щоденник двічі', () => {
      let p = emptyProfile();
      let res = creditGrades(p, [10], cfg, t);
      p = res.profile;

      // Друга оцінка в той самий день
      res = creditGrades(p, [12], cfg, t + 3600000);
      const hotEvent2 = res.events.find(e => e.quest === 'secret_daily_hot');
      assert.strictEqual(hotEvent2, undefined, 'Гарячий щоденник діє не більше 1 разу на день');
    });
  });

  describe('6. Рендеринг та UI-компоненти Solo Leveling & Туману', () => {
    const t = Date.parse('2026-10-12T10:00:00Z');
    const { week } = kyivParts(t);

    test('renderQuests: заблоковані секретні квести не показуються, при тумані рендериться quest-fog-overlay', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 5 }; // стадія twilight для knowledge_gatherer

      const state = { profile: p, config: cfg };
      const root = { innerHTML: '' };
      renderQuests(root, state);

      // Має містити туман twilight
      assert.ok(root.innerHTML.includes('fog-twilight'), 'Має бути клас fog-twilight');
      assert.ok(root.innerHTML.includes('Розвіювання туману: <b>5 / 7</b>'));
      // Заблокований секретний квест не повинен мати картку
      assert.ok(!root.innerHTML.includes('Академічний штурм'));
    });

    test('renderQuests: пробуджений секретний квест рендериться у стилі genshin-astral-card', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 7 }; // розблоковано

      const state = { profile: p, config: cfg };
      const root = { innerHTML: '' };
      renderQuests(root, state);

      assert.ok(root.innerHTML.includes('genshin-astral-card'), 'Має бути клас genshin-astral-card');
      assert.ok(root.innerHTML.includes('badge-astral'), 'Має бути клас badge-astral');
      assert.ok(root.innerHTML.includes('✦ ТАЄМНЕ ДОРУЧЕННЯ'), 'Повинен бути бейдж таємного доручення');
      assert.ok(root.innerHTML.includes('+3 ✦'), 'Повинна бути нагорода +3 ✦');
      assert.ok(root.innerHTML.includes('Академічний штурм'));
      assert.ok(!root.innerHTML.includes('[СИСТЕМНЕ СПОВІЩЕННЯ]'), 'Не повинно бути старого сай-фай тексту');
      assert.ok(!root.innerHTML.includes('ОВЕРДРАЙВ'), 'Не повинно бути старого напису ОВЕРДРАЙВ');
    });

    test('getDisplayQuests: розблокований секрет заміщує батьківський квест в одному слоті без дублювання', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 7 }; // розблоковано secret_academic_overdrive

      const display = getDisplayQuests(cfg.quests, p, { nowMs: t });
      assert.ok(display.some(q => q.id === 'secret_academic_overdrive'), 'Секретний квест повинен бути у списку');
      assert.ok(!display.some(q => q.id === 'knowledge_gatherer'), 'Батьківський квест повинен бути заміщений і не дублюватися');
      const baseCount = cfg.quests.filter(q => !q.secret && q.period !== 'lifetime').length;
      const weeklyMonthlyDisplayCount = display.filter(q => q.period !== 'lifetime').length;
      assert.strictEqual(weeklyMonthlyDisplayCount, baseCount, 'Кількість квестів не повинна подвоюватися');
    });

    test('findNearestQuest та renderNearestQuestBlock: виділяє пробуджений секретний квест у стилі Genshin Astral', () => {
      const p = emptyProfile();
      p.counters[week] = { gradeCount: 8 };

      const nearest = findNearestQuest(p, cfg, t);
      assert.ok(nearest, 'Повинен знайти найближчий квест');
      assert.strictEqual(nearest.isSecret, true, 'Квест повинен бути позначений як секретний');
      assert.strictEqual(nearest.quest.id, 'secret_academic_overdrive', 'Має обрати пробуджений Академічний штурм');

      const homePath = path.resolve(__dirname, '../src/student/home.js');
      const html = fs.readFileSync(homePath, 'utf8');
      assert.ok(html.includes('genshin-astral-card'), 'Має містити клас genshin-astral-card');
      assert.ok(html.includes('ТАЄМНЕ ДОРУЧЕННЯ'), 'Має містити бейдж ТАЄМНЕ ДОРУЧЕННЯ');
      assert.ok(!html.includes('solo-system-card'), 'Не повинно бути застарілого класу solo-system-card');
      assert.ok(!html.includes('СИСТЕМНЕ СПОВІЩЕННЯ'), 'Не повинно бути тексту СИСТЕМНЕ СПОВІЩЕННЯ');
    });
  });
});
