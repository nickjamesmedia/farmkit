import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type Props = {
  session: Session | null;
};

function Login({ session }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(
        error.message === 'Invalid login credentials'
          ? 'Email or password is incorrect. Check with your farm admin if you need help.'
          : error.message,
      );
    }

    setLoading(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="wordmark">Farmkit</div>
          <div className="tagline">Farm equipment & maintenance tracking</div>
        </div>
        <form onSubmit={handleLogin} className="stack">
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {errorMessage && <p className="status error">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default Login;
