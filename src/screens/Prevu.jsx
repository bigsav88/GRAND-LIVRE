import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { COLORS, monthKey, shiftMonth, labelFor, formatCurrency } from '../theme';
import { SectionLabel, ConfirmModal, TextInput } from '../components/ui';
import { getCategories, getForecastForMonth, setForecastValue } from '../lib/api';

export default function Prevu({ currency }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [categories, setCategories] = useState([]);
  const [forecast, setForecast] = useState(new Map());
  const [localValues, setLocalValues] = useState({}); // subId -> string affiché
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState(null);
  const focusRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, fc] = await Promise.all([getCategories(), getForecastForMonth(month)]);
    setCategories(cats);
    setForecast(fc);
    const initial = {};
    for (const [subId, amount] of fc.entries()) initial[subId] = String(amount);
    setLocalValues(initial);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleFocus = (subId) => {
    focusRef.current[subId] = forecast.get(subId) || 0;
  };

  const handleBlur = async (subId, subName, catName) => {
    const before = focusRef.current[subId];
    delete focusRef.current[subId];
    if (before === undefined) return;
    const after = Number(localValues[subId]) || 0;
    if (before === after) return;
    if (before === 0) {
      await setForecastValue(subId, month, after, true);
      load();
    } else {
      setPendingChange({ subId, subName, catName, newValue: after });
    }
  };

  const resolvePending = async (applyToFuture) => {
    if (pendingChange) {
      await setForecastValue(pendingChange.subId, month, pendingChange.newValue, applyToFuture);
      load();
    }
    setPendingChange(null);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mois précédent" style={navBtnStyle}><ChevronLeft size={16} /></button>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, minWidth: 180, textAlign: 'center' }}>{labelFor(month)}</div>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mois suivant" style={navBtnStyle}><ChevronRight size={16} /></button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 24 }}>
        Un montant reste valable pour les mois suivants tant que tu ne le changes pas. Modifier une valeur existante te demandera si le changement vaut pour ce mois seulement ou aussi pour la suite.
      </div>

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
                {cat.budget_subcategories.map(sub => (
                  <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', alignItems: 'center', padding: '4px 0' }}>
                    <span style={{ fontSize: 13, color: COLORS.warm }}>{sub.name}</span>
                    <TextInput
                      type="number"
                      value={localValues[sub.id] ?? ''}
                      onChange={e => setLocalValues(v => ({ ...v, [sub.id]: e.target.value }))}
                      onFocus={() => handleFocus(sub.id)}
                      onBlur={() => handleBlur(sub.id, sub.name, cat.name)}
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                ))}
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
