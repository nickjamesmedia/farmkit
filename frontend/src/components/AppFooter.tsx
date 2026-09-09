import { useState } from 'react';
import ModalX from './ModalX';
import { useLocation } from 'react-router-dom';
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

// What a bug report needs beyond the user-agent string: the UA can't tell a
// phone in portrait from a tablet in landscape, or a PWA from a browser tab.
function deviceInfo() {
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string; mobile?: boolean };
  }).userAgentData;
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    dpr: window.devicePixelRatio,
    orientation:
      window.screen.orientation?.type ??
      (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
    touch: navigator.maxTouchPoints > 0,
    mobile: uaData?.mobile ?? null,
    platform: uaData?.platform || navigator.platform || null,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
  };
}

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
      device_info: deviceInfo(),
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
      <span className="version-badge" title={`Build ${gitSha} · ${builtAt}`}>
        Farmkit v{appVersion} {versionLabel}
      </span>

      {open && (
        <div className="modal-backdrop" onClick={close} style={{ zIndex: 1400 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={close} />
            {sent ? (
              <div className="stack">
                <h2>Thanks — got it.</h2>
                <p style={{ color: 'var(--muted)' }}>
                  Your report was sent to the Farmkit team (dev@farmkit.ca) along
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
                  We automatically include the page you're on ({pathname}), the
                  app version and your device and screen size so the team can
                  find the problem faster.
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
