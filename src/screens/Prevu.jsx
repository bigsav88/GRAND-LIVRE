import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { COLORS, monthKey, shiftMonth, labelFor, formatCurrency } from '../theme';
import { SectionLabel, ConfirmModal, TextInput, MonthPicker, TotalsBar } from '../components/ui';
import { getCategories, getForecastForMonth, setForecastValue, getPreferences } from '../lib/api';

export default function Prevu({ currency, startMonth }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [categories, setCategories] = useState([]);
  const [forecast, setForecast] = useState(new Map());
  const [localValues, setLocalValues] = useState({}); // subId -> string affiché
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState(null);
  const [hideSalary, setHideSalary] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set()); // sous-catégories démasquées temporairement
  const focusRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, fc, prefs] = await Promise.all([getCategories(), getForecastForMonth(month), getPreferences()]);
    setCategories(cats);
    setForecast(fc);
    setHideSalary(!!prefs.hide_salary);
    const initial = {};
    for (const [subId, amount] of fc.entries()) initial[subId] = String(amount);
    setLocalValues(initial);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleFocus = (subId) => {
    focusRef.current[subId] = forecast.get(subId) || 0;
  };

  // Met à jour l'état local (montant ET texte affiché) après une sauvegarde — jamais de
  // rechargement complet ici, pour ne pas faire disparaître momentanément la liste. Les deux
  // états (forecast et localValues) sont maintenant TOUJOURS synchronisés ensemble : c'est ce
  // qui manquait avant et pouvait laisser le champ affiché dans un état incohérent après une
  // suppression de valeur (ex. salaire ou loyer remis à 0).
  const applyLocalForecast = (subId, value) => {
    setForecast(prev => { const m = new Map(prev); m.set(subId, value); return m; });
    setLocalValues(prev => ({ ...prev, [subId]: String(value) }));
  };

  const handleBlur = async (subId, subName, catName) => {
    const before = focusRef.current[subId];
    delete focusRef.current[subId];
    if (before === undefined) return;
    const raw = localValues[subId];
    const after = raw === '' || raw === undefined ? 0 : (Number(raw) || 0);
    if (before === after) return;
    try {
      if (before === 0) {
        await setForecastValue(subId, month, after, true);
        applyLocalForecast(subId, after);
      } else {
        setPendingChange({ subId, subName, catName, newValue: after });
      }
    } catch (err) {
      // En cas d'échec de sauvegarde, on revient à la valeur connue plutôt que de laisser
      // le champ dans un état incertain.
      setLocalValues(prev => ({ ...prev, [subId]: String(before) }));
    }
  };

  const resolvePending = async (applyToFuture) => {
    if (pendingChange) {
      try {
        await setForecastValue(pendingChange.subId, month, pendingChange.newValue, applyToFuture);
        applyLocalForecast(pendingChange.subId, pendingChange.newValue);
      } catch (err) {
        // silencieux : le champ garde sa valeur affichée, l'utilisateur peut réessayer
      }
    }
    setPendingChange(null);
  };

  const totals = useMemo(() => {
    const sum = (type) => categories
      .filter(c => c.type === type)
      .reduce((s, c) => s + c.budget_subcategories.reduce((ss, sub) => ss + (forecast.get(sub.id) || 0), 0), 0);
    return { recettes: sum('recette'), depenses: sum('depense') };
  }, [categories, forecast]);

  const isSalaryCat = (catName) => catName.toLowerCase().includes('salaire');
  const toggleReveal = (subId) => {
    setRevealed(prev => { const s = new Set(prev); s.has(subId) ? s.delete(subId) : s.add(subId); return s; });
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} disabled={!!startMonth && month <= startMonth} aria-label="Mois précédent" style={{ ...navBtnStyle, ...(startMonth && month <= startMonth ? disabledStyle : {}) }}><ChevronLeft size={16} /></button>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, minWidth: 180, textAlign: 'center' }}>{labelFor(month)}</div>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mois suivant" style={navBtnStyle}><ChevronRight size={16} /></button>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 16 }}>
        Un montant reste valable pour les mois suivants tant que tu ne le changes pas. Modifier une valeur existante te demandera si le changement vaut pour ce mois seulement ou aussi pour la suite.
      </div>

      {!loading && <TotalsBar recettes={totals.recettes} depenses={totals.depenses} currency={currency} recetteLabel="Entrées prévues" depenseLabel="Dépenses prévues" />}

      {loading ? (
        <div style={{ color: COLORS.muted, padding: '40px 0', textAlign: 'center' }}>Chargement…</div>
      ) : (
        ['recette', 'depense'].map(type => (
          <div key={type} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: type === 'recette' ? COLORS.green : COLORS.red, display: 'inline-block' }} />
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18 }}>{type === 'recette' ? 'Recettes' : 'Dépenses'}</span>
            </div>
            {categories.filter(c => c.type === type).map(cat => (
              <div key={cat.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 10, padding: '8px 12px' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14, marginBottom: 6 }}>{cat.name}</div>
                {cat.budget_subcategories.map(sub => {
                  const masked = hideSalary && isSalaryCat(cat.name) && !revealed.has(sub.id);
                  return (
                    <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 130px', alignItems: 'center', padding: '4px 0', gap: 6 }}>
                      <span style={{ fontSize: 13, color: COLORS.warm }}>{sub.name}</span>
                      {hideSalary && isSalaryCat(cat.name) ? (
                        <button
                          onClick={() => toggleReveal(sub.id)}
                          aria-label={masked ? 'Afficher' : 'Masquer'}
                          style={{ background: 'transparent', border: 'none', color: COLORS.dim, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                        >
                          {masked ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      ) : <span />}
                      {masked ? (
                        <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: COLORS.dim, letterSpacing: 2 }}>••••••</div>
                      ) : (
                        <TextInput
                          type="number"
                          value={localValues[sub.id] ?? ''}
                          onChange={e => setLocalValues(v => ({ ...v, [sub.id]: e.target.value }))}
                          onFocus={() => handleFocus(sub.id)}
                          onBlur={() => handleBlur(sub.id, sub.name, cat.name)}
                          style={{ textAlign: 'right' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))
      )}

      <ConfirmModal
        open={!!pendingChange}
        title="Nouveau montant prévisionnel"
        message={pendingChange ? `Le montant prévu de « ${pendingChange.subName} » passe à ${formatCurrency(pendingChange.newValue, currency)}. S'applique-t-il aux mois à venir aussi, ou seulement à ${labelFor(month)} ?` : ''}
        options={[
          { label: 'Ce mois seulement', value: false },
          { label: 'Ce mois et les suivants', value: true, primary: true },
        ]}
        onClose={resolvePending}
      />
    </div>
  );
}

const navBtnStyle = { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8, cursor: 'pointer', color: COLORS.text, display: 'flex' };
const disabledStyle = { opacity: 0.35, cursor: 'not-allowed' };
