import React from 'react';
import { COLORS } from '../theme';

// Filet de sécurité : si un écran plante pendant le rendu (erreur JavaScript non gérée),
// on affiche un message récupérable au lieu d'un écran blanc silencieux. Affiche aussi le
// détail technique pour qu'on puisse diagnostiquer précisément si ça se reproduit.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Erreur interceptée par ErrorBoundary :', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: COLORS.textStrong, marginBottom: 10 }}>
              Un problème est survenu
            </div>
            <div style={{ fontSize: 13, color: COLORS.warm, marginBottom: 16, lineHeight: 1.5 }}>
              Cet écran a rencontré une erreur inattendue. Vos données ne sont pas perdues — cliquez ci-dessous pour continuer.
            </div>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ background: COLORS.gold, color: COLORS.bg, border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}
            >
              Recharger l'application
            </button>
            <details style={{ marginTop: 16, fontSize: 11, color: COLORS.dim }}>
              <summary style={{ cursor: 'pointer' }}>Détail technique</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error && this.state.error.message)}</pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
