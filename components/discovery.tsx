'use client';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  currentSuggestion,
  EXPERIENCES,
  needsReassessment,
  Study,
  USEFULNESS_HELP,
  USEFULNESS_QUESTION,
} from '@/lib/study';
type PublicSession = { id: string; state: Study; created_at: string; feedbackStatus?: string };
type Me = { participantId: string; recoveryEnabled: boolean; session: PublicSession | null };
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method,
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new ApiError(data.error ?? 'Something went wrong. Please retry.', r.status);
  return data;
}
function Scale({
  legend,
  value,
  onChange,
  unable = false,
}: {
  legend: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  unable?: boolean;
}) {
  return (
    <fieldset className="scale">
      <legend>{legend}</legend>
      <div className="scale-options">
        {Array.from({ length: 11 }, (_, n) => (
          <label key={n} className={value === n ? 'selected' : ''}>
            <input
              type="radio"
              name={legend}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <div className="scale-anchors">
        <span>{unable ? 'Not at all useful' : 'No intensity'}</span>
        <span>{unable ? 'Extremely useful' : 'Extreme intensity'}</span>
      </div>
      {unable && (
        <label className="check unable">
          <input
            type="radio"
            name={legend}
            checked={value === null}
            onChange={() => onChange(null)}
          />
          Unable to rate
        </label>
      )}
    </fieldset>
  );
}
function IntensityForm({
  experiences,
  onSubmit,
  busy,
  repeated = false,
}: {
  experiences: string[];
  onSubmit: (ratings: Record<string, number>) => void;
  busy: boolean;
  repeated?: boolean;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(ratings);
      }}
    >
      <h2>{repeated ? 'A moment to check in' : 'How are things right now?'}</h2>
      <p>
        Rate the current intensity of every selected experience from 0 to 10. There is no expected
        change.
      </p>
      {experiences.map((e) => (
        <Scale
          key={e}
          legend={`How intense is ${e.toLowerCase()} right now?`}
          value={ratings[e]}
          onChange={(v) => setRatings({ ...ratings, [e]: v! })}
        />
      ))}
      <button disabled={busy || experiences.some((e) => ratings[e] === undefined)}>
        {busy ? 'Saving…' : repeated ? 'Save check-in' : 'Begin session'}
      </button>
    </form>
  );
}
export function Discovery() {
  const [screen, setScreen] = useState<'loading' | 'access' | 'identity' | 'study'>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [recover, setRecover] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [setup, setSetup] = useState<'consent' | 'experiences' | 'intensity'>('consent');
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailCancelled, setEmailCancelled] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }, []);
  const load = useCallback(async () => {
    try {
      const data = await api<Me>('me');
      setMe(data);
      setScreen('study');
    } catch (e) {
      if (e instanceof ApiError) {
        setScreen(e.status === 401 ? 'identity' : 'access');
        if (e.status !== 401 && e.status !== 403) setError(e.message);
      } else {
        setScreen('access');
        setError('Unable to connect. Please retry.');
      }
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const s = me?.session;
  const state = s?.state;
  const current = state ? currentSuggestion(state) : undefined;
  const completed = state?.rounds.filter((r) => r.completedAt).length ?? 0;
  useEffect(() => {
    setEmailSent(!!s?.feedbackStatus);
    setEmailCancelled(s?.feedbackStatus === 'cancelled');
  }, [s?.id, s?.feedbackStatus]);
  const phase =
    screen !== 'study'
      ? screen
      : !state
        ? setup
        : state.status === 'stopped'
          ? 'ended'
          : current
            ? 'listening'
            : needsReassessment(state)
              ? 'checkin'
              : 'round';
  useEffect(() => {
    heading.current?.focus();
  }, [phase]);
  function saveSession(value: PublicSession) {
    setMe((prev) => (prev ? { ...prev, session: value } : prev));
  }
  async function action(name: string, body: unknown = {}) {
    if (!s) return;
    saveSession(await api<PublicSession>(`sessions/${s.id}/${name}`, body));
  }
  function startOver() {
    setMe((prev) => (prev ? { ...prev, session: null } : prev));
    setSetup('consent');
    setConsent(false);
    setAdult(false);
    setSelection([]);
    setEmailSent(false);
    setEmailCancelled(false);
  }
  return (
    <div className="shell">
      <header>
        <a className="brand" href="/" aria-label="Suggestion Discovery home">
          <span className="brand-icon" aria-hidden="true">
            s<span>d</span>
          </span>
          <span>
            Suggestion
            <br />
            Discovery
          </span>
        </a>
        <span className="pilot">
          <span />
          Private technical pilot
        </span>
        {me && (
          <button
            className="text-button"
            onClick={() => setShowRecovery(!showRecovery)}
            aria-expanded={showRecovery}
          >
            Your participant ID
          </button>
        )}
      </header>
      <main>
        <aside className="intro">
          <div className="eyebrow">LISTEN. NOTICE. REFLECT.</div>
          <h1 ref={heading} tabIndex={-1}>
            A little space.
            <br />
            <em>A different perspective.</em>
          </h1>
          <p className="intro-copy">
            Explore how different spoken suggestions feel useful to you, one listening moment at a
            time.
          </p>
          <div className="orbit" aria-hidden="true">
            <div />
            <div />
            <div />
            <span>Room for your experience.</span>
          </div>
          <p className="aside-note">
            No right response. No expected improvement.
            <br />
            You can pause or stop whenever you wish.
          </p>
        </aside>
        <section className="workspace" aria-label="Participant study">
          {showRecovery && me && (
            <section className="card identity-card">
              <h2>Your participant ID</h2>
              <p className="id-value">{me.participantId}</p>
              <p>
                This device remembers you for up to 30 days. Your ID is not a recovery password. A
                separate, optional recovery code lets you return on another device. Keep it private.
              </p>
              {recoveryCode ? (
                <>
                  <p>
                    Save this code now. It will not be shown again. Creating another code replaces
                    it.
                  </p>
                  <code className="recovery-code">{recoveryCode}</code>
                </>
              ) : (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{ code: string }>('recovery', {});
                      setRecoveryCode(r.code);
                      setMe({ ...me, recoveryEnabled: true });
                    })
                  }
                >
                  {me.recoveryEnabled ? 'Replace recovery code' : 'Create recovery code'}
                </button>
              )}
              <div className="button-row">
                <button
                  className="text-button"
                  onClick={() => {
                    setShowRecovery(false);
                    setRecoveryCode('');
                  }}
                >
                  Close
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api('logout', {});
                      setMe(null);
                      setScreen('identity');
                      setRecoveryCode('');
                      setShowRecovery(false);
                    })
                  }
                >
                  Sign out this device
                </button>
              </div>
            </section>
          )}
          {error && (
            <div className="error" role="alert">
              <strong>We couldn’t complete that step.</strong>
              <p>{error}</p>
              <button className="text-button" disabled={busy} onClick={() => void run(load)}>
                Reload saved progress
              </button>
            </div>
          )}
          {screen === 'loading' && (
            <div className="card" role="status">
              Loading your listening space…
            </div>
          )}
          {screen === 'access' && (
            <section className="card">
              <div className="eyebrow">INVITATION ONLY</div>
              <h2>A private space for exploration</h2>
              <p>
                This technical pilot is available by invitation. Enter the access code provided by
                your study team.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api('access', { code });
                    setCode('');
                    await load();
                  });
                }}
              >
                <label className="field">
                  Pilot access code
                  <input
                    type="password"
                    autoComplete="off"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={256}
                  />
                </label>
                <button disabled={busy}>
                  {busy ? 'Checking…' : 'Enter pilot'}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
              <p className="fine">
                Exploratory research · Not treatment · No claim of therapeutic efficacy
              </p>
            </section>
          )}
          {screen === 'identity' && (
            <section className="card">
              <div className="eyebrow">YOUR LISTENING SPACE</div>
              <h2>{recover ? 'Welcome back.' : 'Start with a fresh perspective.'}</h2>
              <p>
                You can participate without giving your name or email address. We create a random
                participant ID to save your responses and recognise returning visits.
              </p>
              {recover ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      setMe(await api<Me>('recover', { code }));
                      setCode('');
                      setScreen('study');
                    });
                  }}
                >
                  <label className="field">
                    Private recovery code
                    <input
                      type="password"
                      autoComplete="off"
                      required
                      minLength={40}
                      maxLength={100}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Recover my ID</button>
                </form>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setMe(await api<Me>('identity', {}));
                      setScreen('study');
                    })
                  }
                >
                  {busy ? 'Creating…' : 'Create participant ID'}
                  <span aria-hidden="true">↗</span>
                </button>
              )}
              <button
                className="text-button"
                onClick={() => {
                  setRecover(!recover);
                  setCode('');
                }}
              >
                {recover
                  ? 'Create a new ID instead'
                  : 'Returning on another device? Use a recovery code'}
              </button>
              <p className="fine">
                Returning on this device is automatic. Recovery across devices is optional. Without
                a saved code, we cannot reconnect a lost ID.
              </p>
            </section>
          )}
          {screen === 'study' && !state && (
            <section className="card">
              {setup === 'consent' ? (
                <>
                  <div className="eyebrow">BEFORE YOU BEGIN</div>
                  <h2>Your choice, at every step.</h2>
                  <p>
                    You’ll choose current challenging experiences, rate their intensity, then listen
                    to five AI-generated suggestions in each round. After each, tell us how useful
                    it was. You can continue for as many rounds as you wish.
                  </p>
                  <div className="info" aria-label="How your data is used">
                    <strong>Your responses will be used for research.</strong>
                    <p>
                      We study how people respond to different spoken suggestions. We record your
                      selected experiences, intensity and usefulness ratings, suggestions, listening
                      events and session details under a random participant ID. Your name and email
                      address are not required to take part.
                    </p>
                    <p>
                      These are coded research data: the ID links your sessions, so we do not
                      promise that every record is completely non-identifiable. Research exports
                      exclude email addresses and sign-in or recovery credentials.
                    </p>
                    <p>
                      After a session, you can optionally provide an email address to receive one
                      personal feedback summary. This is a separate choice and is not required for
                      research participation.
                    </p>
                  </div>
                  <div className="info">
                    <strong>A private technical pilot, not healthcare.</strong>
                    <p>
                      These suggestions may be unhelpful or uncomfortable. They do not diagnose or
                      treat a condition. Do not change medical care based on them. Stop if
                      distressed and contact appropriate local support or your usual care provider.
                      If there is immediate danger, contact local emergency services.
                    </p>
                    <p>
                      Listen in a safe, stationary place. Never use while driving or doing anything
                      that needs your attention. Follow the eye condition only while listening.
                    </p>
                  </div>
                  <details>
                    <summary>Research consent & privacy information</summary>
                    <p>
                      Participation is voluntary and restricted to adults invited to test this
                      technical pilot. This is not an ethics-approved participant recruitment
                      service. It must remain a private pilot pending ethics and privacy review.
                    </p>
                    <p>
                      We record your participant ID, sessions, selected experiences, intensity
                      ratings, exact suggestions, AI metadata, randomisation, eye conditions, audio
                      playback events, usefulness responses, and timestamps. The proposed usefulness
                      question is exploratory and has not been described as a validated measure.
                    </p>
                    <p>
                      Selected experience labels go to OpenAI to generate suggestions. Suggestion
                      text goes to OpenAI for AI-generated speech. Data and audio are stored with
                      Supabase and served via Vercel. Avoid entering identifying details; “Other”
                      needs no description.
                    </p>
                    <p>
                      Research data can be exported by authorised investigators. Device sign-in uses
                      a private cookie. Recovery codes are stored only as hashes. Optional email
                      addresses are encrypted and stored separately; providing one links contact
                      details to a session and reduces anonymity. They are excluded from research
                      exports.
                    </p>
                    <p>
                      Contact the study team through your invitation before consenting if you need
                      details of the investigator, hosting region, retention, withdrawal, or data
                      access. These arrangements must be agreed for this private pilot; this app
                      does not assert regulatory approval. Keep your participant ID for privacy or
                      withdrawal requests.
                    </p>
                  </details>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={adult}
                      onChange={(e) => setAdult(e.target.checked)}
                    />
                    I am 18 or older and have a private pilot invitation.
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I have read the information and voluntarily agree to the collection and use of
                    my coded session data for research. I understand that providing an email address
                    is optional and requires separate consent.
                  </label>
                  <button
                    disabled={!consent || !adult || busy}
                    onClick={() => setSetup('experiences')}
                  >
                    Choose what to explore<span aria-hidden="true">→</span>
                  </button>
                  <p className="fine">Research consent does not include email consent.</p>
                </>
              ) : setup === 'experiences' ? (
                <>
                  <div className="eyebrow">01 / WHAT’S PRESENT</div>
                  <h2>What feels challenging today?</h2>
                  <p>
                    Select one or more experiences you would like to explore. Choose only what feels
                    relevant right now.
                  </p>
                  <fieldset className="experience-grid">
                    <legend className="sr-only">Current challenging experiences</legend>
                    {EXPERIENCES.map((e) => (
                      <label
                        className={selection.includes(e) ? 'experience selected' : 'experience'}
                        key={e}
                      >
                        <input
                          type="checkbox"
                          checked={selection.includes(e)}
                          onChange={(ev) =>
                            setSelection(
                              ev.target.checked
                                ? [...selection, e]
                                : selection.filter((x) => x !== e),
                            )
                          }
                        />
                        <span>{e}</span>
                        <span aria-hidden="true">{selection.includes(e) ? '✓' : '+'}</span>
                      </label>
                    ))}
                  </fieldset>
                  <p className="fine">
                    Other does not require a description. Please do not share personal or
                    identifying details.
                  </p>
                  <button disabled={!selection.length} onClick={() => setSetup('intensity')}>
                    Continue with {selection.length || 'your'} selection
                    {selection.length !== 1 ? 's' : ''}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button className="text-button" onClick={() => setSetup('consent')}>
                    Back
                  </button>
                </>
              ) : (
                <>
                  <div className="eyebrow">02 / YOUR STARTING POINT</div>
                  <IntensityForm
                    experiences={selection}
                    busy={busy}
                    onSubmit={(ratings) =>
                      void run(async () => {
                        saveSession(
                          await api<PublicSession>('sessions', {
                            experiences: selection,
                            ratings,
                            consent,
                            adult,
                          }),
                        );
                      })
                    }
                  />
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setSetup('experiences')}
                  >
                    Back to experiences
                  </button>
                </>
              )}
            </section>
          )}
          {screen === 'study' && s && state?.status === 'active' && (
            <>
              <div className="session-bar">
                <span>SESSION IN PROGRESS</span>
                <span>
                  {completed} round{completed !== 1 ? 's' : ''} complete
                </span>
              </div>
              <section className="card">
                {current ? (
                  <Listening
                    key={current.id}
                    session={s}
                    busy={busy}
                    run={run}
                    save={saveSession}
                  />
                ) : needsReassessment(state) ? (
                  <>
                    <div className="eyebrow">AFTER {completed * 5} SUGGESTIONS</div>
                    <IntensityForm
                      key={completed}
                      repeated
                      experiences={state.experiences}
                      busy={busy}
                      onSubmit={(ratings) => void run(() => action('intensity', { ratings }))}
                    />
                  </>
                ) : (
                  <>
                    <div className="eyebrow">ROUND {state.rounds.length + 1}</div>
                    <h2>
                      {completed ? 'Ready for another perspective?' : 'Make yourself comfortable.'}
                    </h2>
                    <EyeInstruction eye="closed" delayed />
                    <p>
                      Five suggestions, presented one at a time in a random order. You choose when
                      each starts. After each recording, provide a usefulness response before
                      continuing.
                    </p>
                    <label className="check optional">
                      <input
                        type="checkbox"
                        checked={challenge}
                        onChange={(e) => setChallenge(e.target.checked)}
                      />
                      <span>
                        Optional exploration challenge
                        <small>
                          Notice differences in how the suggestions are worded. There is no target
                          response or score.
                        </small>
                      </span>
                    </label>
                    {challenge && (
                      <p className="fine">
                        You can simply notice the wording without trying to feel differently.
                      </p>
                    )}
                    <button disabled={busy} onClick={() => void run(() => action('round'))}>
                      {busy ? 'Preparing five suggestions…' : 'Prepare this round'}
                      <span aria-hidden="true">→</span>
                    </button>
                    <p className="fine">
                      Preparation may take a minute. Your next audio will wait for you.
                    </p>
                  </>
                )}
              </section>
              <button className="stop-button" onClick={() => void run(() => action('stop'))}>
                End this session
              </button>
              <p className="fine centered">
                You may also stop listening and close this page at any time.
                <br />
                Saved responses remain; reload to resume an unfinished session.
              </p>
            </>
          )}
          {screen === 'study' && s && state?.status === 'stopped' && (
            <section className="card">
              <div className="eyebrow">SESSION ENDED</div>
              <h2>Thank you for exploring.</h2>
              <p>
                You completed {completed} round{completed !== 1 ? 's' : ''} and submitted{' '}
                {state.rounds.flatMap((r) => r.suggestions).filter((x) => x.response).length}{' '}
                responses. All responses, including “Unable to rate”, contribute an observation.
                There is no expected improvement.
              </p>
              <p>
                Your session is saved under your participant ID. You can return for another session
                whenever you wish.
              </p>
              <div className="info">
                <h3>Optional: a reflection by email</h3>
                <p>
                  Receive a personal summary of the experiences you explored and your participation
                  after this session. You can leave this blank and finish without receiving email.
                  Your research participation is already saved. The summary contains no treatment
                  advice, and email consent is separate from research consent.
                </p>
                {emailSent ? (
                  <div role="status">
                    <p>
                      {emailCancelled
                        ? 'Your pending email request has been cancelled.'
                        : 'Your request is saved. The study team’s configured email service will send it after the session.'}
                    </p>
                    {!emailCancelled && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api(`sessions/${s.id}/feedback`, undefined, 'DELETE');
                            setEmailCancelled(true);
                          })
                        }
                      >
                        Cancel pending email request
                      </button>
                    )}
                  </div>
                ) : (
                  <FeedbackForm
                    busy={busy}
                    onSubmit={(email) =>
                      void run(async () => {
                        await api(`sessions/${s.id}/feedback`, { email, consent: true });
                        setEmailSent(true);
                      })
                    }
                  />
                )}
              </div>
              <button onClick={startOver} disabled={busy}>
                Begin a new session<span aria-hidden="true">↗</span>
              </button>
            </section>
          )}
          <div className="safety-note">
            <span aria-hidden="true">ⓘ</span>
            <p>
              Listen only in a safe place. Stop if uncomfortable. This exploration is not a
              substitute for professional care.
            </p>
          </div>
        </section>
      </main>
      <footer>
        <span>
          Developed by Dr Rod Rizzo · Pain Scientist · Centre for Pain IMPACT, Neuroscience Research
          Australia.
          <br />
          <a href="mailto:r.rizzo@neura.edu.au">r.rizzo@neura.edu.au</a>
        </span>
        <span>Exploratory research. Your experience, without expectations.</span>
        <span>Technical pilot · v0.1</span>
      </footer>
    </div>
  );
}
function EyeInstruction({ eye, delayed = false }: { eye: 'open' | 'closed'; delayed?: boolean }) {
  return (
    <div className="eye-instruction">
      <span className="eye-symbol" aria-hidden="true">
        {eye === 'open' ? '◉' : '◡'}
      </span>
      <div>
        <strong>This round: eyes {eye}</strong>
        <p>
          {eye === 'closed'
            ? delayed
              ? 'Take one gentle breath in and out, at your own pace. Press Play, then close your eyes. The audio will begin a few seconds after you press Play. When it finishes, open your eyes and rate how useful the suggestion was.'
              : 'This saved round uses the earlier protocol. Close your eyes only while listening and open them immediately after the audio to give your rating.'
            : 'Keep your eyes open while listening. After each suggestion, give your rating.'}{' '}
          The next suggestion never starts automatically.
        </p>
      </div>
    </div>
  );
}
function FeedbackForm({ busy, onSubmit }: { busy: boolean; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (consent) onSubmit(email);
      }}
    >
      <label className="field">
        Email address
        <input
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I choose to provide this email address and separately consent to linking it to this session
        only to receive one feedback summary. It is stored separately from research responses,
        excluded from research exports and not used for marketing.
      </label>
      <button className="secondary" disabled={busy || !consent}>
        Request email summary
      </button>
    </form>
  );
}
function Listening({
  session,
  busy,
  run,
  save,
}: {
  session: PublicSession;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  save: (s: PublicSession) => void;
}) {
  const round = session.state.rounds.at(-1)!;
  const x = currentSuggestion(session.state)!;
  const [prepared, setPrepared] = useState(!!x.audioPath);
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [eventError, setEventError] = useState('');
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [transcript, setTranscript] = useState(false);
  const events = useRef(Promise.resolve());
  const url = `sessions/${session.id}/suggestions/${x.id}`;
  async function event(kind: string, a: HTMLAudioElement) {
    const position = Number.isFinite(a.currentTime) ? a.currentTime : 0;
    const duration = Number.isFinite(a.duration) ? a.duration : 0;
    const clientAt = new Date().toISOString();
    // Serialize playback writes so play/pause/ended cannot race the session CAS.
    const task = events.current
      .catch(() => {})
      .then(async () => {
        const result = await api<PublicSession>(`${url}/events`, {
          event: kind,
          position,
          duration,
          clientAt,
        });
        if (kind === 'ended') save(result);
      });
    events.current = task;
    try {
      await task;
      setEventError('');
    } catch {
      setEventError(
        'A playback event could not be saved. Retry saving listening completion before rating.',
      );
    }
  }
  async function submit() {
    await events.current;
    save(await api<PublicSession>(`${url}/response`, { value }));
  }
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);
  return (
    <>
      <div className="eyebrow">
        ROUND {round.number} <span className="dot">·</span> SUGGESTION {x.position} OF 5
      </div>
      <div className="steps" aria-label={`Suggestion ${x.position} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n < x.position ? 'done' : n === x.position ? 'current' : ''} />
        ))}
      </div>
      <h2>Listen at your own pace.</h2>
      <EyeInstruction
        eye={round.eye}
        delayed={
          x.audioLeadInSeconds !== undefined ||
          (!x.audioPath && round.protocolVersion === 'eyes-closed-v1')
        }
      />
      <div className="audio-player">
        <div className={`wave ${playing ? 'playing' : ''}`} aria-hidden="true">
          {[18, 30, 24, 45, 36, 58, 43, 28, 52, 36, 24, 46, 57, 32, 20, 39, 27, 17, 29].map(
            (h, i) => (
              <i style={{ height: h, animationDelay: `${i * 0.08}s` }} key={i} />
            ),
          )}
        </div>
        <p>AI-generated voice · Standardised pace and tone</p>
        {!prepared ? (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api(`${url}/audio`, {});
                save(await api<PublicSession>(`sessions/${session.id}`));
                setPrepared(true);
              })
            }
          >
            {busy ? 'Preparing audio…' : 'Prepare audio'}
          </button>
        ) : (
          <>
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              src={`/api/${url}/audio`}
              onLoadedMetadata={() => setAudioReady(true)}
              onPlay={(e) => {
                setPlaying(true);
                void event('play', e.currentTarget);
              }}
              onPause={(e) => {
                setPlaying(false);
                if (!e.currentTarget.ended) void event('pause', e.currentTarget);
              }}
              onEnded={(e) => {
                setPlaying(false);
                void event('ended', e.currentTarget);
              }}
              onSeeked={(e) => void event('seeked', e.currentTarget)}
              onError={(e) => {
                setEventError('Audio could not load. Reload the audio or stop the session.');
                void event('error', e.currentTarget);
              }}
              aria-label={`Suggestion ${x.position} audio`}
            />
            {!audioReady && <p role="status">Loading audio…</p>}
            <p className="fine">Press play when you are ready. Audio never plays automatically.</p>
            <button
              className="text-button"
              onClick={() => {
                setAudioReady(false);
                audioRef.current?.load();
              }}
            >
              Reload audio
            </button>
          </>
        )}
      </div>
      {eventError && (
        <div className="error" role="alert">
          <p>{eventError}</p>
          <button
            className="secondary"
            onClick={() => {
              const a = audioRef.current;
              if (a?.ended) void event('ended', a);
              else a?.load();
            }}
          >
            Retry listening completion / reload
          </button>
        </div>
      )}
      {x.heardAt ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(submit);
          }}
        >
          <p className="eyebrow">
            {round.eye === 'closed' ? 'OPEN YOUR EYES NOW · YOUR RESPONSE' : 'YOUR RESPONSE'}
          </p>
          <Scale legend={USEFULNESS_QUESTION} value={value} onChange={setValue} unable />
          <p className="help">{USEFULNESS_HELP}</p>
          <p className="fine">
            Think about: {session.state.experiences.join(', ')}. This is an exploratory question,
            not a validated measure. Choose the response that fits; 0 is a valid response.
          </p>
          <button disabled={busy || value === undefined}>
            {busy ? 'Saving…' : 'Submit response'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      ) : (
        <p className="help">
          The response question becomes available after listening.{' '}
          {round.eye === 'closed' ? 'Open your eyes immediately when the audio finishes.' : ''}
        </p>
      )}
      <details onToggle={(e) => setTranscript(e.currentTarget.open)}>
        <summary>Accessible transcript</summary>
        {transcript && (
          <>
            <p>{x.text}</p>
            <p className="fine">
              Text is an accessibility alternative. This pilot records audio playback events but
              cannot verify attention or whether audio was heard. If you cannot complete listening,
              end the session and contact the study team.
            </p>
          </>
        )}
      </details>
    </>
  );
}
