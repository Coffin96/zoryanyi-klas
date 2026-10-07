export function levelOf(earned, cfg) {
  let level = 0;
  for (const lvl of cfg.levels) {
    if (earned >= lvl.min) level = lvl.level;
    else break;
  }
  return level;
}

export function progressTo(profile, item, cfg, nowMs) {
  const have = profile.balance;
  const need = item.price;
  const missing = need > have ? need - have : 0;
  let canBuy = missing === 0;
  let reason = canBuy ? null : 'insufficient';
  
  const lim = item.limits ?? {};
  if (canBuy && lim.cooldownDays) {
    const last = profile.lastAt?.[item.id];
    if (last != null && nowMs - last < lim.cooldownDays * 86400000) {
      canBuy = false;
      reason = 'cooldown';
    }
  }
  // We can add month limits check here too if needed, but this is enough for basic display
  return { need, have, missing, canBuy, reason };
}

export function affordable(profile, cfg, nowMs, stock) {
  return cfg.shop.filter(item => item.active).map(item => {
    const p = progressTo(profile, item, cfg, nowMs);
    let st = stock[item.id];
    if (st != null && st <= 0) {
      p.canBuy = false;
      p.reason = 'out-of-stock';
    }
    return { item, ...p };
  });
}

export function forecastDemand(profiles, cfg, nowMs, stock) {
  const demand = {};
  for (const p of profiles) {
    const items = affordable(p, cfg, nowMs, stock).filter(x => x.canBuy && x.item.category === 'sweet');
    if (items.length > 0) {
      const top = items.reduce((max, x) => x.item.price > max.item.price ? x : max, items[0]);
      demand[top.item.id] = (demand[top.item.id] ?? 0) + 1;
    }
  }
  return demand;
}

export function validateConfig(cfg) {
  const errors = [];
  const ids = new Set();
  
  for (const item of cfg.shop) {
    if (ids.has(item.id)) errors.push({ level: 'error', path: `shop.${item.id}`, msg: 'duplicate id' });
    ids.add(item.id);
    if (item.price < 0) errors.push({ level: 'error', path: `shop.${item.id}`, msg: 'negative price' });
  }
  
  if (!cfg.levels || cfg.levels.length === 0 || cfg.levels[0].min !== 0) {
    errors.push({ level: 'error', path: 'levels', msg: 'min:0 level missing' });
  }
  
  return errors;
}

export function budgetSummary({ ledgers, cfg, from, to }) {
  const summary = { totalCost: 0, totalStars: 0, items: {} };
  for (const l of ledgers) {
    if (l.type === 'redeem' && l.date >= from && l.date <= to) {
      summary.totalCost += l.cost || 0;
      summary.totalStars += l.qty * l.price;
      summary.items[l.item] = (summary.items[l.item] || 0) + l.qty;
    }
  }
  summary.starValue = summary.totalStars > 0 ? summary.totalCost / summary.totalStars : 0;
  return summary;
}

export function recommendPrice(item, cfg) {

  if (!item.unitCost) return 0;
  const disc = item.discount || 0;
  return Math.round((item.unitCost / cfg.settings.refPerStar) * (1 - disc));
}
