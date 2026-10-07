const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Київська дата з мілісекунд.
 * @param {number} ms 
 * @returns {{ymd: string, month: string, day: number}}
 */
export function kyivParts(ms) {
  const [y, m, d] = fmt.format(ms).split('-').map(Number);
  return {
    ymd: `${String(y).slice(2)}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`,
    month: `${String(y).slice(2)}${String(m).padStart(2, '0')}`,
    day: Math.floor(Date.UTC(y, m - 1, d) / 86400000),
  };
}
