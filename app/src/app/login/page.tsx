'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';

const LOGO_GRADIENT = 'linear-gradient(135deg,#FFD600 0%,#E500E5 100%)';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Invalid email or password');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 20 }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 360, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 16, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: LOGO_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 23, color: 'var(--color-ink)' }}>
            K
          </div>
          <div className="hd" style={{ fontSize: 21 }}>Kojeflow</div>
        </div>

        <div>
          <div style={FIELD_LABEL_STYLE}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={FIELD_STYLE}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div>
          <div style={FIELD_LABEL_STYLE}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={FIELD_STYLE}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <div style={{ fontSize: 13, color: 'var(--color-red)' }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="pbtn"
          style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
