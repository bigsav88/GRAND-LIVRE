import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, AlertTriangle, Link2, Link2Off } from 'lucide-react';
import { COLORS, monthKey, shiftMonth, labelFor, formatCurrency } from '../theme';
import { SectionLabel, SummaryCard, PieBlock, computeEcart, MonthPicker } from '../components/ui';
import {
  getCategories, getForecastForMonth, getMonthlyActuals, getYearData,
  getMonthNetActual, getMonthLinkSetting, setMonthLinkSetting,
  getPreferences, updatePreferences,
} from '../lib/api';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function Dashboard({ currency, startMonth }) {
  const [view, setView] = useState('mois'); // 'mois' | 'annee'
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [categories, setCategories] = useState([]);
  const [forecast, setForecast] = useState(new Map());
  const [actuals, setActuals] = useState(new Map());
  const [yearData, setYearData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkPrevious, setLinkPrevious] = useState(false);
  const [previousNet, setPreviousNet] = useState(0);
  const [linkBusy, setLinkBusy] = useState(false);
  const [showUnbalanced, setShowUnbalanced] = useState(false);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    const [cats, fc, ac, linked, prevNet] = await Promise.all([
      getCategories(),
      getForecastForMonth(month),
      getMonthlyActuals(month),
      getMonthLinkSetting(month),
      getMonthNetActual(shiftMonth(month, -1)),
    ]);
    setCategories(cats);
    setForecast(fc);
    setActuals(ac);
    setLinkPrevious(linked);
    setPreviousNet(prevNet);
    setLoading(false);
  }, [month]);

  const loadYear = useCallback(async () => {
    setLoading(true);
    const [cats, yd] = await Promise.all([getCategories(), getYearData(year)]);
    setCategories(cats);
    setYearData(yd);
    setLoading(false);
  }, [year]);

  useEffect(() => {
    if (view === 'mois') loadMonth();
    else loadYear();
  }, [view, loadMonth, loadYear]);

  const toggleLink = async () => {
    setLinkBusy(true);
    try {
      const next = !linkPrevious;
      await setMonthLinkSetting(month, next);
      setLinkPrevious(next); // reflète immédiatement, sans recharger le reste — aucun effet de bord ailleurs
    } finally {
      setLinkBusy(false);
    }
  };

  // ---------------- Vue mensuelle ----------------
  const monthComputed = useMemo(() => {
    if (view !== 'mois') return null;
    const withTotals = (cats) => cats.map(c => {
      const prevu = c.budget_subcategories.reduce((s, sub) => s + (forecast.get(sub.id) || 0), 0);
      const reel = c.budget_subcategories.reduce((s, sub) => s + (actuals.get(sub.id) || 0), 0);
      return { ...c, prevu, reel };
    });
    const recCats = withTotals(categories.filter(c => c.type === 'recette'));
    const depCats = withTotals(categories.filter(c => c.type === 'depense'));
    const recPrevu = recCats.reduce((s, c) => s + c.prevu, 0);
    // Le rattachement au mois précédent s'ajoute uniquement à l'affichage/au calcul,
    // jamais comme une saisie stockée — cocher/décocher ne peut donc rien casser.
    const recReel = recCats.reduce((s, c) => s + c.reel, 0) + (linkPrevious ? previousNet : 0);
    const depPrevu = depCats.reduce((s, c) => s + c.prevu, 0);
    const depReel = depCats.reduce((s, c) => s + c.reel, 0);
    const depEcart = depCats.reduce((s, c) => s + computeEcart(c.prevu, c.reel, 'depense', c.budget_type === 'epargne'), 0);
    const chartData = [...recCats, ...depCats].map(c => ({ name: c.name, Prévu: c.prevu, Réel: c.reel }));
    const pieData = {
      recPie: recCats.map(c => ({ name: c.name, value: c.reel })).filter(s => s.value > 0),
      depPie: depCats.map(c => ({ name: c.name, value: c.reel })).filter(s => s.value > 0),
    };
    return { sums: { recPrevu, recReel, depPrevu, depReel, depEcart, soldePrevu: recPrevu - depPrevu, soldeReel: recReel - depReel }, chartData, pieData };
  }, [view, categories, forecast, actuals, linkPrevious, previousNet]);

  // Notification "budget non équilibré" : opt-in, au maximum une fois par semaine glissante.
  useEffect(() => {
    if (view !== 'mois' || loading || !monthComputed) { setShowUnbalanced(false); return; }
    if (monthComputed.sums.soldeReel === 0) { setShowUnbalanced(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getPreferences();
        if (cancelled || !prefs.notify_unbalanced) { setShowUnbalanced(false); return; }
        const last = prefs.last_unbalanced_notice_at ? new Date(prefs.last_unbalanced_notice_at).getTime() : 0;
        if (Date.now() - last >= WEEK_MS) {
          setShowUnbalanced(true);
          await updatePreferences({ last_unbalanced_notice_at: new Date().toISOString() });
        }
      } catch (e) { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [view, loading, monthComputed]);

  // ---------------- Vue annuelle ----------------
  const yearComputed = useMemo(() => {
    if (view !== 'annee' || !yearData) return null;
    const subTotal = (subId) => {
      let prevu = 0, reel = 0;
      yearData.forecastsByMonth.forEach(fc => { prevu += fc.get(subId) || 0; });
      yearData.actualsByMonth.forEach(ac => { reel += ac.get(subId) || 0; });
      return { prevu, reel };
    };
    const withTotals = (cats) => cats.map(c => {
      const totals = c.budget_subcategories.reduce((acc, sub) => {
        const t = subTotal(sub.id);
        return { prevu: acc.prevu + t.prevu, reel: acc.reel + t.reel };
      }, { prevu: 0, reel: 0 });
      return { ...c, ...totals };
    });
    const recCats = withTotals(categories.filter(c => c.type === 'recette'));
    const depCats = withTotals(categories.filter(c => c.type === 'depense'));
    const recPrevu = recCats.reduce((s, c) => s + c.prevu, 0);
    const recReel = recCats.reduce((s, c) => s + c.reel, 0);
    const depPrevu = depCats.reduce((s, c) => s + c.prevu, 0);
    const depReel = depCats.reduce((s, c) => s + c.reel, 0);
    const depEcart = depCats.reduce((s, c) => s + computeEcart(c.prevu, c.reel, 'depense', c.budget_type === 'epargne'), 0);
    const chartData = [...recCats, ...depCats].map(c => ({ name: c.name, Prévu: c.prevu, Réel: c.reel }));
    const pieData = {
      recPie: recCats.map(c => ({ name: c.name, value: c.reel })).filter(s => s.value > 0),
      depPie: depCats.map(c => ({ name: c.name, value: c.reel })).filter(s => s.value > 0),
    };
    const recSubIds = new Set(recCats.flatMap(c => c.budget_subcategories.map(s => s.id)));
    const monthlyTrend = yearData.months.map((m, i) => {
      let recTotal = 0, depTotal = 0;
      yearData.actualsByMonth[i].forEach((val, subId) => {
        if (recSubIds.has(subId)) recTotal += val; else depTotal += val;
      });
      return { name: labelFor(m).slice(0, 3), Recettes: recTotal, Dépenses: depTotal };
    });
    return { sums: { recPrevu, recReel, depPrevu, depReel, depEcart, soldePrevu: recPrevu - depPrevu, soldeReel: recReel - depReel }, chartData, pieData, monthlyTrend };
  }, [view, yearData, categories]);

  const computed = view === 'mois' ? monthComputed : yearComputed;

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {['mois', 'annee'].map(v => (
          <button
            key={v} onClick={() => setView(v)}
            style={{
              background: view === v ? COLORS.gold : 'transparent', color: view === v ? COLORS.bg : COLORS.muted,
              border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
            }}
          >
            {v === 'mois' ? 'Mois' : 'Année'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {view === 'mois' ? (
          <>
            <button onClick={() => setMonth(m => shiftMonth(m, -1))} disabled={!!startMonth && month <= startMonth} aria-label="Mois précédent" style={{ ...navBtnStyle, ...(startMonth && month <= startMonth ? disabledStyle : {}) }}><ChevronLeft size={16} /></button>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, minWidth: 180, textAlign: 'center' }}>{labelFor(month)}</div>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mois suivant" style={navBtnStyle}><ChevronRight size={16} /></button>
            <MonthPicker value={month} onChange={setMonth} />
          </>
        ) : (
          <>
            <button onClick={() => setYear(y => y - 1)} disabled={!!startMonth && year <= Number(startMonth.slice(0, 4))} aria-label="Année précédente" style={{ ...navBtnStyle, ...(startMonth && year <= Number(startMonth.slice(0, 4)) ? disabledStyle : {}) }}><ChevronLeft size={16} /></button>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, minWidth: 180, textAlign: 'center' }}>{year}</div>
            <button onClick={() => setYear(y => y + 1)} aria-label="Année suivante" style={navBtnStyle}><ChevronRight size={16} /></button>
          </>
        )}
      </div>

      {view === 'mois' && !loading && (
        <button
          onClick={toggleLink}
          disabled={linkBusy}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            background: linkPrevious ? 'rgba(201,162,75,0.12)' : COLORS.panel,
            border: `1px solid ${linkPrevious ? COLORS.gold : COLORS.border}`,
            color: linkPrevious ? COLORS.gold : COLORS.muted,
            borderRadius: 8, padding: '10px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
            opacity: linkBusy ? 0.6 : 1,
          }}
        >
          {linkPrevious ? <Link2 size={14} /> : <Link2Off size={14} />}
          Lié au mois précédent ({labelFor(shiftMonth(month, -1))})
          <span className="num" style={{ color: previousNet >= 0 ? COLORS.green : COLORS.red, marginLeft: 4 }}>
            {linkPrevious ? (previousNet >= 0 ? '+' : '') + formatCurrency(previousNet, currency) : `(${formatCurrency(previousNet, currency)} non inclus)`}
          </span>
        </button>
      )}

      {view === 'mois' && showUnbalanced && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: COLORS.panel, border: `1px solid ${COLORS.gold}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, flexWrap: 'wrap' }}>
          <AlertTriangle size={16} style={{ color: COLORS.gold, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 220 }}>
            Budget non équilibré ce mois-ci : solde réel de{' '}
            <span className="num" style={{ color: monthComputed.sums.soldeReel >= 0 ? COLORS.green : COLORS.red }}>{formatCurrency(monthComputed.sums.soldeReel, currency)}</span>.
          </span>
          <button onClick={() => setShowUnbalanced(false)} style={{ background: 'transparent', color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Fermer</button>
        </div>
      )}

      {loading || !computed ? (
        <div style={{ color: COLORS.muted, padding: '40px 0', textAlign: 'center' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
            <SummaryCard label={view === 'mois' ? 'Recettes' : 'Recettes (année)'} prevu={computed.sums.recPrevu} reel={computed.sums.recReel} type="recette" currency={currency} />
            <SummaryCard label={view === 'mois' ? 'Dépenses' : 'Dépenses (année)'} prevu={computed.sums.depPrevu} reel={computed.sums.depReel} type="depense" currency={currency} ecartOverride={computed.sums.depEcart} />
            <SummaryCard label={view === 'mois' ? 'Solde' : 'Solde (année)'} prevu={computed.sums.soldePrevu} reel={computed.sums.soldeReel} type="recette" currency={currency} />
          </div>

          {view === 'annee' && computed.monthlyTrend && (
            <>
              <SectionLabel>Tendance mensuelle</SectionLabel>
              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '20px 12px 8px', marginTop: 12, marginBottom: 32 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={computed.monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                    <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                    <Tooltip contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12 }} formatter={(v) => formatCurrency(v, currency)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Recettes" fill={COLORS.green} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Dépenses" fill={COLORS.red} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <SectionLabel>{view === 'annee' ? "Comparatif visuel par catégorie (cumul de l'année)" : 'Comparatif visuel par catégorie'}</SectionLabel>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '20px 12px 8px', marginTop: 12, marginBottom: 32 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={computed.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <Tooltip contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12 }} formatter={(v) => formatCurrency(v, currency)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Prévu" fill={COLORS.dim} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Réel" fill={COLORS.gold} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionLabel>{view === 'annee' ? 'Répartition par catégorie (réel, cumul)' : 'Répartition par catégorie (réel)'}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
            <PieBlock title="Recettes" data={computed.pieData.recPie} currency={currency} />
            <PieBlock title="Dépenses" data={computed.pieData.depPie} currency={currency} />
          </div>
        </>
      )}
    </div>
  );
}

const navBtnStyle = { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8, cursor: 'pointer', color: COLORS.text, display: 'flex' };
const disabledStyle = { opacity: 0.35, cursor: 'not-allowed' };
