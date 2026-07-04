import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type Props = {
  session: Session | null;
};

function Welcome({ session }: Props) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const { error: acceptError } = await supabase.rpc('farmkit_accept_my_invites');
    if (acceptError) {
      setError(acceptError.message);
      setSaving(false);
      return;
    }

    setMessage('Password saved.');
    setSaving(false);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="app">
      <div className="card stack" style={{ marginTop: '2rem' }}>
        <div className="page-head">
          <h1>Welcome to Farmkit</h1>
        </div>

        {!session ? (
          <div className="stack">
            <p className="status">
              Your invite session is not active. Open the latest invite link or sign in.
            </p>
            <button type="button" onClick={() => navigate('/login')}>
              Go to login
            </button>
          </div>
        ) : (
          <form className="stack" onSubmit={handleSubmit}>
            <label>
              <span>Set password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save password'}
            </button>
            {message && <p className="status">{message}</p>}
            {error && <p className="status error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default Welcome;
