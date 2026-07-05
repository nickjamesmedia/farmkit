import { useState } from 'react';
import ModalX from './ModalX';
import { useLocation, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';

type Props = {
  session: Session | null;
  appVersion: string;
  versionLabel: string;
  gitSha: string;
  builtAt: string;
};

function AppFooter({ session, appVersion, versionLabel, gitSha, builtAt }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'feedback' | 'bug'>('feedback');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pathname } = useLocation();
  const { activeFarmId } = useNavData();

  const close = () => {
    setOpen(false);
    setSent(false);
    setError(null);
    setMessage('');
    setKind('feedback');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    if (!message.trim()) {
      setError('Tell us what happened first.');
      return;
    }
    setSending(true);
    setError(null);
    const { error: err } = await supabase.from('feedback').insert({
      auth_user_id: session.user.id,
      farm_id: activeFarmId,
      kind,
      message: message.trim(),
      page_path: pathname,
      page_title: document.title,
      app_version: `${appVersion}+${gitSha}`,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
    setSending(false);
  };

  return (
    <>
      {session && (
        <button
          type="button"
          className="feedback-badge"
          onClick={() => setOpen(true)}
        >
          Feedback / Report a bug
        </button>
      )}
      <Link
        className="version-badge"
        to="/dev/rls"
        title={`Build ${gitSha} · ${builtAt}`}
      >
        Farmkit v{appVersion} {versionLabel}
      </Link>

      {open && (
        <div className="modal-backdrop" onClick={close} style={{ zIndex: 1400 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={close} />
            {sent ? (
              <div className="stack">
                <h2>Thanks — got it.</h2>
                <p style={{ color: 'var(--muted)' }}>
                  Your report was sent to the Farmkit team (dev@farmkit.app) along
                  with the page you were on.
                </p>
                <button type="button" onClick={close}>
                  Done
                </button>
              </div>
            ) : (
              <form className="stack" onSubmit={handleSubmit}>
                <h2>Feedback</h2>
                <label>
                  <span>What kind?</span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as 'feedback' | 'bug')}
                  >
                    <option value="feedback">Suggestion / feedback</option>
                    <option value="bug">Something is broken</option>
                  </select>
                </label>
                <label>
                  <span>{kind === 'bug' ? 'What went wrong?' : 'What should we improve?'}</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      kind === 'bug'
                        ? 'What did you tap, and what happened?'
                        : 'Tell us what would make Farmkit work better for you.'
                    }
                    required
                  />
                </label>
                <p className="row-sub">
                  We automatically include the page you're on ({pathname}) and the
                  app version so the team can find the problem faster.
                </p>
                {error && <p className="status error">{error}</p>}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button type="submit" disabled={sending}>
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                  <button type="button" className="secondary" onClick={close}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AppFooter;
