import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Camera, Loader2, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { COLORS, monthKey, shiftMonth, labelFor, formatCurrency } from '../theme';
import { PrimaryButton, GhostButton, TextInput, MonthPicker, TotalsBar } from '../components/ui';
import { getCategories, getEntriesForMonth, getMonthlyActuals, addEntry, deleteEntry, uploadReceipt, extractReceipt, getReceiptSignedUrl, getPreferences } from '../lib/api';

export default function Depenses({ currency, startMonth }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [otherActuals, setOtherActuals] = useState(0); // total recettes du mois, pour la barre
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subcategoryId: '', amount: '', entryDate: new Date().toISOString().slice(0, 10), comment: '' });
  const [saving, setSaving] = useState(false);
  const [receiptPath, setReceiptPath] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [allowFuture, setAllowFuture] = useState(false);
  const fileInputRef = useRef(null);

  const isFutureMonth = month > monthKey(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [allCats, ent, prefs] = await Promise.all([getCategories(), getEntriesForMonth(month), getPreferences()]);
    const depCats = allCats.filter(c => c.type === 'depense');
    setCategories(depCats);
    setEntries(ent);
    setAllowFuture(!!prefs.allow_future_actuals);

    const recCats = allCats.filter(c => c.type === 'recette');
    const actuals = await getMonthlyActuals(month);
    const recTotal = recCats.reduce((s, c) => s + c.budget_subcategories.reduce((ss, sub) => ss + (actuals.get(sub.id) || 0), 0), 0);
    setOtherActuals(recTotal);

    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const depenseSubIds = new Set(categories.flatMap(c => c.budget_subcategories.map(s => s.id)));
  const depenseEntries = entries.filter(e => depenseSubIds.has(e.subcategory_id));
  const subLabel = (id) => {
    for (const c of categories) {
      const s = c.budget_subcategories.find(s => s.id === id);
      if (s) return `${c.name} — ${s.name}`;
    }
    return '—';
  };

  const handleFile = async (file) => {
    if (!file) return;
    setExtractError('');
    setReceiptPreview(URL.createObjectURL(file));
    setExtracting(true);
    try {
      const path = await uploadReceipt(file);
      setReceiptPath(path);
      const result = await extractReceipt(path); // { montant, date, marchand }
      setForm(f => ({
        ...f,
        amount: result.montant != null ? String(result.montant) : f.amount,
        entryDate: result.date || f.entryDate,
        comment: result.marchand ? `Reçu : ${result.marchand}` : f.comment,
      }));
    } catch (err) {
      setExtractError("L'extraction automatique a échoué — vérifie les montants avant d'enregistrer.");
    } finally {
      setExtracting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subcategoryId || !form.amount) return;
    if (isFutureMonth && !allowFuture) return;
    setSaving(true);
    try {
      await addEntry({
        subcategoryId: form.subcategoryId,
        amount: Number(form.amount),
        entryDate: form.entryDate,
        comment: form.comment,
        receiptUrl: receiptPath,
      });
      setForm({ subcategoryId: '', amount: '', entryDate: new Date().toISOString().slice(0, 10), comment: '' });
      setReceiptPath(null);
      setReceiptPreview(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteEntry(id);
    load();
  };

  const viewReceipt = async (path) => {
    const url = await getReceiptSignedUrl(path);
    window.open(url, '_blank');
  };

  const total = useMemo(() => depenseEntries.reduce((s, e) => s + Number(e.amount), 0), [depenseEntries]);
  const blocked = isFutureMonth && !allowFuture;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} disabled={!!startMonth && month <= startMonth} aria-label="Mois précédent" style={{ ...navBtnStyle, ...(startMonth && month <= startMonth ? disabledStyle : {}) }}><ChevronLeft size={16} /></button>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, minWidth: 180, textAlign: 'center' }}>{labelFor(month)}</div>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mois suivant" style={navBtnStyle}><ChevronRight size={16} /></button>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {!loading && <TotalsBar recettes={otherActuals} depenses={total} currency={currency} recetteLabel="Recettes de ce mois" depenseLabel="Dépenses de ce mois" />}

      {blocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: COLORS.panel, border: `1px solid ${COLORS.gold}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          <AlertTriangle size={16} style={{ color: COLORS.gold, flexShrink: 0 }} />
          <span>
            {labelFor(month)} n'a pas encore commencé — la saisie de dépenses réelles est désactivée pour ce mois.
            Active « Renseigner les mois à venir » dans Préférences si tu veux tester à l'avance.
          </span>
        </div>
      )}

      <form onSubmit={submit} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, marginBottom: 24, opacity: blocked ? 0.5 : 1, pointerEvents: blocked ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <GhostButton type="button" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Camera size={14} /> Photo du reçu
          </GhostButton>
          {receiptPreview && <img src={receiptPreview} alt="Reçu" style={{ height: 48, borderRadius: 4, border: `1px solid ${COLORS.border}` }} />}
          {extracting && <span style={{ fontSize: 12, color: COLORS.gold, display: 'flex', alignItems: 'center', gap: 5 }}><Loader2 size={13} className="spin" /> Lecture du reçu…</span>}
        </div>
        {extractError && <div style={{ color: COLORS.red, fontSize: 12, marginBottom: 10 }}>{extractError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 140px', gap: 10, alignItems: 'end' }}>
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
            <TextInput value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="ex. marchand, contexte de la dépense" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <PrimaryButton type="submit" disabled={saving || blocked} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
              <Plus size={14} /> Enregistrer
            </PrimaryButton>
          </div>
        </div>
      </form>

      {loading ? (
        <div style={{ color: COLORS.muted, padding: '20px 0', textAlign: 'center' }}>Chargement…</div>
      ) : depenseEntries.length === 0 ? (
        <div style={{ color: COLORS.dim, fontSize: 13, textAlign: 'center', padding: '30px 0', border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
          Aucune dépense enregistrée pour {labelFor(month)}.
        </div>
      ) : (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {depenseEntries.map(e => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 24px 28px', alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${COLORS.borderSoft}`, fontSize: 13 }}>
              <span className="num" style={{ color: COLORS.dim }}>{e.entry_date}</span>
              <span>
                {subLabel(e.subcategory_id)}
                {e.comment && <span style={{ color: COLORS.dim, fontSize: 11 }}> — {e.comment}</span>}
              </span>
              <span className="num" style={{ textAlign: 'right', color: COLORS.red }}>{formatCurrency(e.amount, currency)}</span>
              {e.receipt_url ? (
                <button onClick={() => viewReceipt(e.receipt_url)} aria-label="Voir le reçu" style={{ background: 'transparent', border: 'none', color: COLORS.gold, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                  <ImageIcon size={14} />
                </button>
              ) : <span />}
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
const disabledStyle = { opacity: 0.35, cursor: 'not-allowed' };
const labelStyle = { fontSize: 11, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
const inputBoxStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: 'Inter', fontSize: 13, borderRadius: 6, padding: '8px 10px' };
