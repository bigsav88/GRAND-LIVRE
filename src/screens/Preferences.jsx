import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, LogOut } from 'lucide-react';
import { COLORS, BUDGET_TYPES } from '../theme';
import { SectionLabel, PrimaryButton, TextInput } from '../components/ui';
import {
  getPreferences, updatePreferences, getCategories, addCategory, addSubcategory,
  renameCategory, setCategoryBudgetType, renameSubcategory, archiveCategory, archiveSubcategory, signOut,
} from '../lib/api';

export default function Preferences() {
  const [prefs, setPrefs] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, cats] = await Promise.all([getPreferences(), getCategories()]);
    setPrefs(p);
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const targetSum = prefs ? prefs.target_essentiel + prefs.target_envie + prefs.target_epargne : 100;

  const savePrefs = async () => {
    if (targetSum !== 100) return;
    await updatePreferences({
      salaire_prevu: prefs.salaire_prevu,
      target_essentiel: prefs.target_essentiel,
      target_envie: prefs.target_envie,
      target_epargne: prefs.target_epargne,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddCategory = async (type) => {
    const name = window.prompt('Nom de la nouvelle catégorie ?');
    if (!name) return;
    await addCategory({ type, name, budgetType: type === 'depense' ? 'essentiel' : null });
    load();
  };

  const handleAddSub = async (catId) => {
    const name = window.prompt('Nom de la nouvelle sous-catégorie ?');
    if (!name) return;
    await addSubcategory(catId, name);
    load();
  };

  if (loading || !prefs) {
    return <div style={{ color: COLORS.muted, padding: '40px 0', textAlign: 'center' }}>Chargement…</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
      <SectionLabel>Revenu &amp; répartition</SectionLabel>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 18, marginTop: 12, marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Salaire mensuel</label>
          <TextInput type="number" value={prefs.salaire_prevu} onChange={e => setPrefs({ ...prefs, salaire_prevu: Number(e.target.value) })} style={{ maxWidth: 200 }} />
        </div>
        {BUDGET_TYPES.map(bt => (
          <div key={bt.key} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>{bt.label}</span>
              <span className="num" style={{ color: bt.accent }}>{prefs[`target_${bt.key}`]}%</span>
            </div>
            <input
              type="range" min="0" max="100" value={prefs[`target_${bt.key}`]}
              onChange={e => setPrefs({ ...prefs, [`target_${bt.key}`]: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        ))}
        <div style={{ fontSize: 12, color: targetSum === 100 ? COLORS.green : COLORS.red, marginBottom: 12 }}>
          Total : {targetSum}% {targetSum !== 100 && '— doit faire 100%'}
        </div>
        <PrimaryButton onClick={savePrefs} disabled={targetSum !== 100} style={{ opacity: targetSum !== 100 ? 0.5 : 1 }}>
          {saved ? 'Enregistré ✓' : 'Enregistrer'}
        </PrimaryButton>
      </div>

      {['recette', 'depense'].map(type => (
        <div key={type} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: type === 'recette' ? COLORS.green : COLORS.red, display: 'inline-block' }} />
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18 }}>{type === 'recette' ? 'Recettes' : 'Dépenses'}</span>
            </div>
            <button onClick={() => handleAddCategory(type)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
              <Plus size={13} /> Catégorie
            </button>
          </div>

          {categories.filter(c => c.type === type).map(cat => (
            <div key={cat.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TextInput value={cat.name} onChange={e => { renameCategory(cat.id, e.target.value); }} style={{ flex: 1, background: 'transparent', border: 'none', fontFamily: "'Fraunces', serif", fontSize: 14, padding: '2px 0' }} />
                {type === 'depense' && (
                  <select
                    value={cat.budget_type || 'essentiel'}
                    onChange={e => setCategoryBudgetType(cat.id, e.target.value).then(load)}
                    style={{ fontSize: 11, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: '3px 6px' }}
                  >
                    {BUDGET_TYPES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                )}
                <button onClick={() => archiveCategory(cat.id).then(load)} aria-label="Retirer la catégorie" style={{ background: 'transparent', border: 'none', color: COLORS.red, cursor: 'pointer', display: 'flex' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ paddingLeft: 4, marginTop: 6 }}>
                {cat.budget_subcategories.map(sub => (
                  <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    <TextInput value={sub.name} onChange={e => renameSubcategory(sub.id, e.target.value)} style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', padding: '2px 0', color: COLORS.warm }} />
                    <button onClick={() => archiveSubcategory(sub.id).then(load)} aria-label="Retirer" style={{ background: 'transparent', border: 'none', color: COLORS.red, cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button onClick={() => handleAddSub(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: COLORS.dim, fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                  <Plus size={12} /> Sous-catégorie
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer', marginTop: 20 }}>
        <LogOut size={13} /> Se déconnecter
      </button>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
