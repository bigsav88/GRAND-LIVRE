import React, { useEffect, useState, useCallback } from 'react';
import { LayoutDashboard, CalendarClock, ArrowDownCircle, ArrowUpCircle, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { COLORS, FONT_IMPORT } from './theme';
import { getSession, onAuthChange, getPreferences } from './lib/api';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import Dashboard from './screens/Dashboard';
import Prevu from './screens/Prevu';
import Recettes from './screens/Recettes';
import Depenses from './screens/Depenses';
import Preferences from './screens/Preferences';

const TABS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, Comp: Dashboard },
  { key: 'prevu', label: 'Prévisionnel', icon: CalendarClock, Comp: Prevu },
  { key: 'recettes', label: 'Recettes', icon: ArrowUpCircle, Comp: Recettes },
  { key: 'depenses', label: 'Dépenses', icon: ArrowDownCircle, Comp: Depenses },
  { key: 'preferences', label: 'Préférences', icon: Settings, Comp: Preferences },
];

const CURRENCY = 'XOF'; // à rendre configurable plus tard si besoin
const SIDEBAR_WIDTH_OPEN = 220;
const SIDEBAR_WIDTH_COLLAPSED = 60;

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = pas encore vérifié
  const [onboarded, setOnboarded] = useState(undefined);
  const [startMonth, setStartMonth] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false); // replié (icônes seules) par défaut

  const checkOnboarding = useCallback(async () => {
    try {
      const prefs = await getPreferences();
      setOnboarded(!!prefs.onboarded_at);
      setStartMonth(prefs.start_month || null);
    } catch (e) {
      setOnboarded(false);
    }
  }, []);

  useEffect(() => {
    getSession().then(s => setSession(s));
    const sub = onAuthChange(s => setSession(s));
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) checkOnboarding();
    else setOnboarded(undefined);
  }, [session, checkOnboarding]);

  if (session === undefined || (session && onboarded === undefined)) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <style>{FONT_IMPORT}</style>
        Chargement…
      </div>
    );
  }

  if (!session) return <Auth />;
  if (!onboarded) return <Onboarding onDone={checkOnboarding} />;

  const ActiveComp = TABS.find(t => t.key === tab).Comp;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif", display: 'flex' }}>
      <style>{`
        ${FONT_IMPORT}
        .num { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Barre latérale gauche, fixe, repliée par défaut (icônes seules) */}
      <div style={{
        width: sidebarOpen ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_COLLAPSED, flexShrink: 0,
        borderRight: `1px solid ${COLORS.border}`, position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto', overflowX: 'hidden', padding: '16px 10px', transition: 'width 0.15s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center', marginBottom: 20, paddingLeft: sidebarOpen ? 6 : 0 }}>
          {sidebarOpen && (
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: COLORS.textStrong, margin: 0, whiteSpace: 'nowrap' }}>Grand Livre</h1>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Réduire le menu' : 'Agrandir le menu'}
            title={sidebarOpen ? 'Réduire le menu' : 'Agrandir le menu'}
            style={{ background: 'transparent', border: 'none', color: COLORS.muted, cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6, flexShrink: 0 }}
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                title={t.label}
                aria-label={t.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: active ? COLORS.panel : 'transparent',
                  border: 'none', borderLeft: active ? `2px solid ${COLORS.gold}` : '2px solid transparent',
                  color: active ? COLORS.textStrong : COLORS.muted,
                  padding: sidebarOpen ? '10px 12px' : '10px 0', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter',
                  borderRadius: 6, textAlign: 'left', width: '100%',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{t.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu de l'écran actif */}
      <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        <ActiveComp currency={CURRENCY} startMonth={startMonth} />
      </div>
    </div>
  );
}
