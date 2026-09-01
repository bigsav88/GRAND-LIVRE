import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { COLORS, monthKey, shiftMonth, labelFor, formatCurrency } from '../theme';
import { PrimaryButton, TextInput } from '../components/ui';
import { getCategories, getEntriesForMonth, addEntry, deleteEntry } from '../lib/api';

export default function Recettes({ currency }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subcategoryId: '', amount: '', entryDate: new Date().toISOString().slice(0, 10), comment: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, ent] = await Promise.all([getCategories(), getEntriesForMonth(month)]);
    setCategories(cats.filter(c => c.type === 'recette'));
    setEntries(ent);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const recetteSubIds = new Set(categories.flatMap(c => c.budget_subcategories.map(s => s.id)));
  const recetteEntries = entries.filter(e => recetteSubIds.has(e.subcategory_id));
  const subLabel = (id) => {
    for (const c of categories) {
      const s = c.budget_subcategories.find(s => s.id === id);
      if (s) return `${c.name} — ${s.name}`;
    }
    return '—';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subcategoryId || !form.amount) return;
    setSaving(true);
    try {
      await addEntry({ subcategoryId: form.subcategoryId, amount: Number(form.amount), entryDate: form.entryDate, comment: form.comment });
      setForm({ subcategoryId: '', amount: '', entryDate: new Date().toISOString().slice(0, 10), comment: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteEntry(id);
    load();
  };

  const total = recetteEntries.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mois précédent" style={navBtnStyle}><ChevronLeft size={16} /></button>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, minWidth: 180, textAlign: 'center' }}>{labelFor(month)}</div>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mois suivant" style={navBtnStyle}><ChevronRight size={16} /></button>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: COLORS.green }} className="num">Total : {formatCurrency(total, currency)}</div>
      </div>

      <form onSubmit={submit} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 130px 140px', gap: 10, alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Sous-catégorie</label>
          <select
            required value={form.subcategoryId} onChange={e => setForm({ ...form, subcategoryId: e.target.value })}
            style={{ ...inputBoxStyle, width: '100%' }}
          >
            <option value="">Choisir…</option>
            {categories.map(c => (
              <optgroup key={c.id} label={c.name}>
                {c.budget_subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Montant</label>
          <TextInput type="number" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <TextInput type="date" required value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Commentaire (optionnel)</label>
          <TextInput value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="ex. prime exceptionnelle" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <PrimaryButton type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            <Plus size={14} /> Enregistrer
          </PrimaryButton>
        </div>
      </form>

      {loading ? (
        <div style={{ color: COLORS.muted, padding: '20px 0', textAlign: 'center' }}>Chargement…</div>
      ) : recetteEntries.length === 0 ? (
        <div style={{ color: COLORS.dim, fontSize: 13, textAlign: 'center', padding: '30px 0', border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
          Aucune recette enregistrée pour {labelFor(month)}.
        </div>
      ) : (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {recetteEntries.map(e => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 28px', alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${COLORS.borderSoft}`, fontSize: 13 }}>
              <span className="num" style={{ color: COLORS.dim }}>{e.entry_date}</span>
              <span>
                {subLabel(e.subcategory_id)}
                {e.comment && <span style={{ color: COLORS.dim, fontSize: 11 }}> — {e.comment}</span>}
              </span>
              <span className="num" style={{ textAlign: 'right', color: COLORS.green }}>{formatCurrency(e.amount, currency)}</span>
              <button onClick={() => remove(e.id)} aria-label="Supprimer" style={{ background: 'transparent', border: 'none', color: COLORS.red, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const navBtnStyle = { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8, cursor: 'pointer', color: COLORS.text, display: 'flex' };
const labelStyle = { fontSize: 11, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
const inputBoxStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: 'Inter', fontSize: 13, borderRadius: 6, padding: '8px 10px' };
