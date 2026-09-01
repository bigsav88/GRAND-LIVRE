export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');`;

export const COLORS = {
  bg: '#12151F',
  panel: '#1A1F2E',
  border: '#2E3446',
  borderSoft: '#1E2330',
  text: '#EDE9DE',
  textStrong: '#F4F1E8',
  warm: '#C7C2B4',
  muted: '#9098AC',
  dim: '#5B6478',
  gold: '#C9A24B',
  green: '#4FAE8B',
  red: '#C1502E',
};

export const BUDGET_TYPES = [
  { key: 'essentiel', label: 'Besoin essentiel', accent: COLORS.red },
  { key: 'envie', label: 'Envie / loisir', accent: COLORS.gold },
  { key: 'epargne', label: 'Épargne / investissement', accent: COLORS.green },
];

export const CURRENCIES = [
  { code: 'XOF', label: 'Franc CFA (XOF)' },
  { code: 'USD', label: 'Dollar américain (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
];

export function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatCurrency(value, currency) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
  } catch (e) {
    return `${fmt(value)} ${currency}`;
  }
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
export function labelFor(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
