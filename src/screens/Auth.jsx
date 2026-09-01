import React, { useState } from 'react';
import { signIn, signUp } from '../lib/api';
import { COLORS, FONT_IMPORT } from '../theme';
import { PrimaryButton, TextInput } from '../components/ui';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.');
        setMode('signin');
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ maxWidth: 380, width: '100%' }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: COLORS.textStrong, marginBottom: 4 }}>Grand Livre</h1>
        <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 28 }}>
          {mode === 'signin' ? 'Connecte-toi à ton budget.' : 'Crée ton compte pour démarrer.'}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
            <TextInput type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mot de passe</label>
            <TextInput type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: 4 }} />
          </div>

          {error && <div style={{ color: COLORS.red, fontSize: 12 }}>{error}</div>}
          {info && <div style={{ color: COLORS.green, fontSize: 12 }}>{info}</div>}

          <PrimaryButton type="submit" disabled={loading} style={{ marginTop: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : "Créer mon compte"}
          </PrimaryButton>
        </form>

        <div style={{ marginTop: 18, fontSize: 12, color: COLORS.muted, textAlign: 'center' }}>
          {mode === 'signin' ? (
            <>Pas encore de compte ? <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: COLORS.gold, cursor: 'pointer', fontSize: 12, padding: 0 }}>En créer un</button></>
          ) : (
            <>Déjà un compte ? <button onClick={() => setMode('signin')} style={{ background: 'none', border: 'none', color: COLORS.gold, cursor: 'pointer', fontSize: 12, padding: 0 }}>Se connecter</button></>
          )}
        </div>
      </div>
    </div>
  );
}
