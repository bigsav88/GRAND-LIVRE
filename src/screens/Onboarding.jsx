import React, { useState } from 'react';
import { COLORS, FONT_IMPORT, monthKey } from '../theme';
import { PrimaryButton, GhostButton, TextInput, SectionLabel, MonthPicker } from '../components/ui';
import { BUDGET_TYPES } from '../theme';
import { addCategory, addSubcategory, setForecastValue, updatePreferences } from '../lib/api';

const SUGGESTED_RECETTES = [
  { name: 'Salaire', subs: ['Salaire principal'] },
  { name: 'Freelance', subs: ['Missions'] },
];

const SUGGESTED_DEPENSES = [
  { name: 'Logement', budgetType: 'essentiel', subs: ['Loyer', 'Électricité', 'Eau', 'Internet'] },
  { name: 'Transport', budgetType: 'essentiel', subs: ['Carburant', 'Transport en commun'] },
  { name: 'Alimentation', budgetType: 'essentiel', subs: ['Courses', 'Restaurants'] },
  { name: 'Église', budgetType: 'essentiel', subs: ['Dîmes', 'Offrandes'] },
  { name: 'Loisirs', budgetType: 'envie', subs: ['Sorties', 'Abonnements'] },
  { name: 'Épargne', budgetType: 'epargne', subs: ['Épargne mensuelle', 'Investissements'] },
];

function buildInitialSelection(list) {
  return list.map(cat => ({
    name: cat.name,
    budgetType: cat.budgetType,
    checked: true,
    subs: cat.subs.map(nom => ({ nom, checked: true })),
  }));
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [salaire, setSalaire] = useState('');
  const [startMonth, setStartMonth] = useState(() => monthKey(new Date()));
  const [recettes, setRecettes] = useState(() => buildInitialSelection(SUGGESTED_RECETTES));
  const [depenses, setDepenses] = useState(() => buildInitialSelection(SUGGESTED_DEPENSES));
  const [targets, setTargets] = useState({ essentiel: 50, envie: 30, epargne: 20 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const targetSum = targets.essentiel + targets.envie + targets.epargne;

  const toggleCat = (list, setList, idx) => {
    setList(list.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c));
  };
  const toggleSub = (list, setList, catIdx, subIdx) => {
    setList(list.map((c, i) => i !== catIdx ? c : { ...c, subs: c.subs.map((s, j) => j === subIdx ? { ...s, checked: !s.checked } : s) }));
  };
  const setCatBudgetType = (list, setList, idx, budgetType) => {
    setList(list.map((c, i) => i === idx ? { ...c, budgetType } : c));
  };

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      const currentMonth = startMonth;

      // 1. Préférences (salaire + répartition cible + mois de démarrage)
      await updatePreferences({
        salaire_prevu: Number(salaire) || 0,
        target_essentiel: targets.essentiel,
        target_envie: targets.envie,
        target_epargne: targets.epargne,
        start_month: startMonth,
        onboarded_at: new Date().toISOString(),
      });

      // 2. Catégories + sous-catégories cochées (recettes, puis dépenses)
      const createGroup = async (list, type) => {
        for (const cat of list) {
          if (!cat.checked) continue;
          const checkedSubs = cat.subs.filter(s => s.checked);
          if (!checkedSubs.length) continue;
          const catRow = await addCategory({ type, name: cat.name, budgetType: cat.budgetType });
          for (const sub of checkedSubs) {
            const subRow = await addSubcategory(catRow.id, sub.nom);
            // Le salaire renseigné à l'étape 2 devient la première ligne de prévisionnel récurrent.
            if (type === 'recette' && cat.name === 'Salaire' && sub.nom === 'Salaire principal' && Number(salaire) > 0) {
              await setForecastValue(subRow.id, currentMonth, Number(salaire), true);
            }
          }
        }
      };
      await createGroup(recettes, 'recette');
      await createGroup(depenses, 'depense');

      onDone();
    } catch (err) {
      setError(err.message || "Une erreur est survenue pendant l'enregistrement.");
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif", padding: '40px 20px' }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: COLORS.textStrong, marginBottom: 4 }}>Configuration de ton budget</h1>
        <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 8 }}>Étape {step + 1} sur 4 — tout est modifiable plus tard dans Préférences.</div>
        <div style={{ height: 3, background: COLORS.border, borderRadius: 2, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((step + 1) / 4) * 100}%`, background: COLORS.gold, transition: 'width 0.2s' }} />
        </div>

        {step === 0 && (
          <div>
            <SectionLabel>Revenu principal</SectionLabel>
            <div style={{ fontSize: 13, color: COLORS.warm, margin: '8px 0 16px' }}>Quel est ton salaire mensuel habituel ?</div>
            <TextInput type="number" min="0" placeholder="0" value={salaire} onChange={e => setSalaire(e.target.value)} />

            <div style={{ marginTop: 22 }}>
              <SectionLabel>Mois de démarrage</SectionLabel>
              <div style={{ fontSize: 13, color: COLORS.warm, margin: '8px 0 10px' }}>
                À partir de quel mois veux-tu commencer à suivre ton budget ? (tu ne pourras pas naviguer avant ce mois)
              </div>
              <MonthPicker value={startMonth} onChange={setStartMonth} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <SectionLabel>Catégories récurrentes</SectionLabel>
            <div style={{ fontSize: 13, color: COLORS.warm, margin: '8px 0 16px' }}>
              Décoche ce qui ne te concerne pas. Chaque catégorie de dépense est rattachée à un des 3 blocs (modifiable plus tard).
            </div>

            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: COLORS.green, marginBottom: 8 }}>Recettes</div>
            {recettes.map((cat, i) => (
              <CategoryRow key={cat.name} cat={cat} onToggleCat={() => toggleCat(recettes, setRecettes, i)} onToggleSub={(j) => toggleSub(recettes, setRecettes, i, j)} />
            ))}

            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: COLORS.red, margin: '18px 0 8px' }}>Dépenses</div>
            {depenses.map((cat, i) => (
              <CategoryRow
                key={cat.name} cat={cat}
                onToggleCat={() => toggleCat(depenses, setDepenses, i)}
                onToggleSub={(j) => toggleSub(depenses, setDepenses, i, j)}
                onBudgetType={(v) => setCatBudgetType(depenses, setDepenses, i, v)}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <SectionLabel>Répartition cible</SectionLabel>
            <div style={{ fontSize: 13, color: COLORS.warm, margin: '8px 0 16px' }}>
              Garde 50/30/20 (recommandé) ou ajuste — le total doit faire 100 %.
            </div>
            {BUDGET_TYPES.map(bt => (
              <div key={bt.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{bt.label}</span>
                  <span className="num" style={{ color: bt.accent }}>{targets[bt.key]}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={targets[bt.key]}
                  onChange={e => setTargets({ ...targets, [bt.key]: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
            <div style={{ fontSize: 12, color: targetSum === 100 ? COLORS.green : COLORS.red, marginTop: 8 }}>
              Total : {targetSum}% {targetSum !== 100 && '— doit faire 100%'}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <SectionLabel>Confirmation</SectionLabel>
            <div style={{ fontSize: 13, color: COLORS.warm, margin: '8px 0 16px', lineHeight: 1.6 }}>
              Salaire mensuel : <strong className="num" style={{ color: COLORS.textStrong }}>{salaire || 0}</strong><br />
              Répartition : <strong style={{ color: COLORS.textStrong }}>{targets.essentiel}/{targets.envie}/{targets.epargne}</strong><br />
              Catégories sélectionnées : <strong style={{ color: COLORS.textStrong }}>
                {[...recettes, ...depenses].filter(c => c.checked).length}
              </strong>
            </div>
            {error && <div style={{ color: COLORS.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          <GhostButton onClick={() => setStep(s => Math.max(0, s - 1))} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
            Précédent
          </GhostButton>
          {step < 3 ? (
            <PrimaryButton onClick={() => setStep(s => s + 1)} disabled={step === 2 && targetSum !== 100} style={{ opacity: step === 2 && targetSum !== 100 ? 0.5 : 1 }}>
              Suivant
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={finish} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enregistrement…' : 'Terminer'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ cat, onToggleCat, onToggleSub, onBudgetType }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 8, padding: '10px 12px', opacity: cat.checked ? 1 : 0.45 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={cat.checked} onChange={onToggleCat} />
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14 }}>{cat.name}</span>
        {onBudgetType && cat.checked && (
          <select
            value={cat.budgetType} onChange={e => onBudgetType(e.target.value)}
            className="currency-select" style={{ marginLeft: 'auto', fontSize: 11, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: '3px 6px' }}
          >
            {BUDGET_TYPES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        )}
      </div>
      {cat.checked && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, paddingLeft: 24 }}>
          {cat.subs.map((s, j) => (
            <label key={s.nom} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: COLORS.warm }}>
              <input type="checkbox" checked={s.checked} onChange={() => onToggleSub(j)} />
              {s.nom}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
