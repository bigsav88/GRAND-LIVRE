import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { COLORS, formatCurrency } from '../theme';

export const PIE_COLORS = ['#C9A24B', '#4FAE8B', '#C1502E', '#6C8EBF', '#9B6B9E', '#D98E48', '#5B6478', '#4B8FA6'];

export function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.muted, fontWeight: 500 }}>{children}</div>;
}

// écart : positif calculé "à la manière d'une recette" (reel - prevu) quand isEpargne est vrai,
// sinon "à la manière d'une dépense" (prevu - reel) pour type === 'depense'.
export function computeEcart(prevu, reel, type, isEpargne) {
  if (type === 'depense' && isEpargne) return reel - prevu;
  return type === 'depense' ? prevu - reel : reel - prevu;
}

export function SummaryCard({ label, prevu, reel, type, currency, ecartOverride }) {
  const ecart = ecartOverride !== undefined ? ecartOverride : computeEcart(prevu, reel, type);
  const good = ecart >= 0;
  const Icon = ecart === 0 ? Minus : (good ? TrendingUp : TrendingDown);
  const ecartColor = ecart === 0 ? COLORS.muted : (good ? COLORS.green : COLORS.red);
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '16px 18px' }}>
      <SectionLabel>{label}</SectionLabel>
      <div className="num" style={{ fontSize: 24, marginTop: 6, color: COLORS.textStrong }}>{formatCurrency(reel, currency)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12 }}>
        <span style={{ color: COLORS.dim }}>prévu <span className="num">{formatCurrency(prevu, currency)}</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: ecartColor, marginLeft: 'auto' }}>
          <Icon size={12} />
          <span className="num">{ecart > 0 ? '+' : ''}{formatCurrency(ecart, currency)}</span>
        </span>
      </div>
    </div>
  );
}

export function PieBlock({ title, data, currency }) {
  if (!data.length) {
    return (
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '20px 12px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 8 }}>{title}</div>
        <div style={{ color: COLORS.dim, fontSize: 12, textAlign: 'center', padding: '30px 0' }}>Aucun montant réel renseigné.</div>
      </div>
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '16px 12px' }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 4, paddingLeft: 4 }}>{title}</div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke={COLORS.bg} strokeWidth={1} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontFamily: 'Inter', fontSize: 12 }}
            labelStyle={{ color: COLORS.text }}
            formatter={(v, n) => [`${formatCurrency(v, currency)} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`, n]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthPicker({ value, onChange }) {
  return (
    <input
      type="month"
      value={value}
      onChange={e => e.target.value && onChange(e.target.value)}
      aria-label="Aller directement à un mois"
      title="Aller directement à un mois"
      style={{
        background: COLORS.panel, border: `1px solid ${COLORS.border}`, color: COLORS.text,
        fontFamily: 'Inter', fontSize: 12, borderRadius: 6, padding: '7px 8px', colorScheme: 'dark', cursor: 'pointer',
      }}
    />
  );
}

export function TotalsBar({ recettes, depenses, currency, recetteLabel = 'Entrées', depenseLabel = 'Dépenses', showEcart = true }) {
  const ecart = recettes - depenses;
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20, display: 'flex', gap: 20, flexWrap: 'wrap',
      background: 'rgba(18,21,31,0.92)', backdropFilter: 'blur(6px)', border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13,
    }}>
      <span>
        <span style={{ color: COLORS.dim, marginRight: 6 }}>{recetteLabel}</span>
        <span className="num" style={{ color: COLORS.green }}>{formatCurrency(recettes, currency)}</span>
      </span>
      <span>
        <span style={{ color: COLORS.dim, marginRight: 6 }}>{depenseLabel}</span>
        <span className="num" style={{ color: COLORS.red }}>{formatCurrency(depenses, currency)}</span>
      </span>
      {showEcart && (
        <span style={{ marginLeft: 'auto' }}>
          <span style={{ color: COLORS.dim, marginRight: 6 }}>Écart</span>
          <span className="num" style={{ color: ecart >= 0 ? COLORS.green : COLORS.red, fontWeight: 600 }}>
            {ecart > 0 ? '+' : ''}{formatCurrency(ecart, currency)}
          </span>
        </span>
      )}
    </div>
  );
}

export function ConfirmModal({ open, title, message, options, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,18,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 24, maxWidth: 440, width: '100%', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 10, color: COLORS.textStrong }}>{title}</div>
        <div style={{ fontSize: 13, color: COLORS.warm, marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {options.map(opt => (
            <button
              key={opt.label}
              onClick={() => onClose(opt.value)}
              style={{
                background: opt.primary ? COLORS.gold : 'transparent',
                color: opt.primary ? COLORS.bg : COLORS.text,
                border: opt.primary ? 'none' : `1px solid ${COLORS.border}`,
                borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter',
                fontWeight: opt.primary ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CategoryTable({ title, type, cats, currency, accent }) {
  const sorted = [...cats].sort((a, b) => b.reel - a.reel);
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
        {sorted.length === 0 ? (
          <div style={{ color: COLORS.dim, fontSize: 12, textAlign: 'center', padding: '24px 0' }}>Aucune donnée pour cette période.</div>
        ) : sorted.map(c => {
          const isEpargne = type === 'depense' && c.budget_type === 'epargne';
          const ecart = computeEcart(c.prevu, c.reel, type, isEpargne);
          const good = ecart >= 0;
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 110px', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: `1px solid ${COLORS.borderSoft}`, fontSize: 12 }}>
              <span style={{ color: COLORS.warm }}>{c.name}</span>
              <span className="num" style={{ textAlign: 'right', color: COLORS.dim }}>{formatCurrency(c.prevu, currency)}</span>
              <span className="num" style={{ textAlign: 'right', color: accent }}>{formatCurrency(c.reel, currency)}</span>
              <span className="num" style={{ textAlign: 'right', color: good ? COLORS.green : COLORS.red }}>{ecart > 0 ? '+' : ''}{formatCurrency(ecart, currency)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button {...props} style={{ background: COLORS.gold, color: COLORS.bg, border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', ...(props.style || {}) }}>
      {children}
    </button>
  );
}

export function GhostButton({ children, ...props }) {
  return (
    <button {...props} style={{ background: 'transparent', color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter', ...(props.style || {}) }}>
      {children}
    </button>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text,
        fontFamily: 'Inter', fontSize: 13, borderRadius: 6, padding: '8px 10px', width: '100%',
        ...(props.style || {}),
      }}
    />
  );
}
