import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, LogOut, AlertTriangle, RotateCcw } from 'lucide-react';
import { COLORS, BUDGET_TYPES, monthKey, labelFor } from '../theme';
import { SectionLabel, PrimaryButton, TextInput, MonthPicker, ConfirmModal } from '../components/ui';
import {
  getPreferences, updatePreferences, getCategories, addCategory, addSubcategory,
  renameCategory, setCategoryBudgetType, renameSubcategory, archiveCategory, archiveSubcategory, signOut,
  requestMonthDeletion, getPendingDeletions, restoreMonthDeletion,
} from '../lib/api';

export default function Preferences() {
  const [prefs, setPrefs] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [deleteScope, setDeleteScope] = useState('mois'); // 'mois' | 'annee'
  const [deleteMonth, setDeleteMonth] = useState(() => monthKey(new Date()));
  const [deleteYear, setDeleteYear] = useState(() => new Date().getFullYear());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState('');
  const [pending, setPending] = useState([]);
  const [restoringId, setRestoringId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, cats, pend] = await Promise.all([getPreferences(), getCategories(), getPendingDeletions()]);
    setPrefs(p);
    setCategories(cats);
    setPending(pend);
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
      start_month: prefs.start_month,
      allow_future_actuals: prefs.allow_future_actuals,
      notify_unbalanced: prefs.notify_unbalanced,
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

  const monthsToDelete = deleteScope === 'mois'
    ? [deleteMonth]
    : Array.from({ length: 12 }, (_, i) => `${deleteYear}-${String(i + 1).padStart(2, '0')}`);

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      const { succeeded, skipped } = await requestMonthDeletion(monthsToDelete);
      const parts = [];
      if (succeeded.length) parts.push(`${succeeded.length} mois envoyé(s) en corbeille`);
      if (skipped.length) parts.push(`${skipped.length} déjà en cours de suppression`);
      setDeletedNotice(parts.join(', ') || 'Rien à supprimer.');
      setTimeout(() => setDeletedNotice(''), 5000);
      load();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleRestore = async (row) => {
    setRestoringId(row.id);
    try {
      await restoreMonthDeletion(row.id, row.month);
      load();
    } finally {
      setRestoringId(null);
    }
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
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mois de démarrage du budget</label>
          <div style={{ fontSize: 11, color: COLORS.dim, marginBottom: 6 }}>Le mois à partir duquel tu peux naviguer dans l'application.</div>
          <MonthPicker value={prefs.start_month || monthKey(new Date())} onChange={v => setPrefs({ ...prefs, start_month: v })} />
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
        <div style={{ fontSize: 12, color: targetSum === 100 ? COLORS.green : COLORS.red, marginBottom: 20 }}>
          Total : {targetSum}% {targetSum !== 100 && '— doit faire 100%'}
        </div>

        <ToggleRow
          label="Renseigner les mois à venir"
          hint="Autorise la saisie de recettes/dépenses réelles sur un mois qui n'a pas encore commencé (utile pour des tests)."
          checked={!!prefs.allow_future_actuals}
          onChange={v => setPrefs({ ...prefs, allow_future_actuals: v })}
        />
        <ToggleRow
          label="Me notifier si le budget n'est pas équilibré"
          hint="Un message s'affichera sur le tableau de bord, au maximum une fois par semaine."
          checked={!!prefs.notify_unbalanced}
          onChange={v => setPrefs({ ...prefs, notify_unbalanced: v })}
        />

        <PrimaryButton onClick={savePrefs} disabled={targetSum !== 100} style={{ opacity: targetSum !== 100 ? 0.5 : 1, marginTop: 4 }}>
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

      <SectionLabel>Gestion des mois</SectionLabel>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 18, marginTop: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 12, lineHeight: 1.5 }}>
          Supprime les recettes et dépenses saisies pour un mois — ou une année entière. Les données restent
          récupérables pendant <strong style={{ color: COLORS.warm }}>30 jours</strong> (un e-mail te préviendra
          2 jours avant la suppression définitive), puis sont effacées pour de bon. Le prévisionnel récurrent et
          les autres mois ne sont jamais touchés.
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 3, width: 'fit-content' }}>
          {['mois', 'annee'].map(v => (
            <button
              key={v} onClick={() => setDeleteScope(v)}
              style={{
                background: deleteScope === v ? COLORS.red : 'transparent', color: deleteScope === v ? '#fff' : COLORS.muted,
                border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
              }}
            >
              {v === 'mois' ? 'Un mois' : 'Une année entière'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {deleteScope === 'mois' ? (
            <MonthPicker value={deleteMonth} onChange={setDeleteMonth} />
          ) : (
            <TextInput
              type="number" value={deleteYear} onChange={e => setDeleteYear(Number(e.target.value))}
              style={{ width: 100 }}
            />
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter' }}
          >
            <Trash2 size={14} />
            {deleteScope === 'mois' ? `Supprimer ${labelFor(deleteMonth)}` : `Supprimer toute l'année ${deleteYear}`}
          </button>
          {deletedNotice && <span style={{ fontSize: 12, color: COLORS.green }}>{deletedNotice}</span>}
        </div>
      </div>

      {pending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>Corbeille</SectionLabel>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 12, overflow: 'hidden' }}>
            {pending.map(row => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${COLORS.borderSoft}`, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Fraunces', serif" }}>{labelFor(row.month)}</span>
                <span style={{ color: COLORS.dim, fontSize: 12 }}>
                  récupérable jusqu'au {new Date(row.purge_at).toLocaleDateString('fr-FR')}
                </span>
                <button
                  onClick={() => handleRestore(row)}
                  disabled={restoringId === row.id}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${COLORS.gold}`, color: COLORS.gold, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', opacity: restoringId === row.id ? 0.6 : 1 }}
                >
                  <RotateCcw size={12} /> {restoringId === row.id ? 'Restauration…' : 'Restaurer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        title={deleteScope === 'mois' ? 'Supprimer ce mois ?' : 'Supprimer cette année ?'}
        message={
          deleteScope === 'mois'
            ? `Les recettes et dépenses de ${labelFor(deleteMonth)} seront déplacées en corbeille, récupérables pendant 30 jours, puis supprimées définitivement. Confirmer ?`
            : `Les recettes et dépenses des 12 mois de ${deleteYear} seront déplacées en corbeille, récupérables pendant 30 jours, puis supprimées définitivement. Confirmer ?`
        }
        options={[
          { label: 'Annuler', value: false },
          { label: deleting ? 'Suppression…' : 'Oui, supprimer', value: true, primary: true },
        ]}
        onClose={(confirmed) => { if (confirmed) handleDeleteConfirmed(); else setConfirmDelete(false); }}
      />

      <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer', marginTop: 20 }}>
        <LogOut size={13} /> Se déconnecter
      </button>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontSize: 13, color: COLORS.text }}>{label}</div>
        <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 2 }}>{hint}</div>
      </div>
    </label>
  );
}
