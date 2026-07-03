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
  const [statusMessage, setStatusMessage] = useState('');

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatusMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatusMessage(error.message);
    } else {
      setStatusMessage('Logged in.');
    }

    setLoading(false);
  };

  return (
    <div className="app">
      <div className="card">
        <h1>Supabase Login</h1>
        <form onSubmit={handleLogin} className="stack">
          <label className="stack">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="stack">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
        {statusMessage && <p className="status">{statusMessage}</p>}
      </div>
    </div>
  );
}

export default Login;
