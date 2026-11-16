'use client';
import { FormEvent, useState } from 'react';
import type { AnalysisWindow, QualityReport } from '@/lib/research-quality';
const display = (value: number | null) =>
  value === null ? '—' : Number(value.toFixed(1)).toString();
const label = (value: string) => value.replaceAll('_', ' ');
export function ResearchDashboard() {
  const [credential, setCredential] = useState(''),
    [window, setWindow] = useState<AnalysisWindow>('primary'),
    [report, setReport] = useState<QualityReport | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch(`/api/research/quality?window=${window}`, {
        headers: { Authorization: `Bearer ${credential}` },
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Investigator credential not recognised.'
            : 'The report could not be loaded. Check configuration and retry.',
        );
      setReport(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The report could not be loaded.');
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `suggestion-discovery-quality-${report.pilot.pilotVersion}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="research-shell">
      <a href="/">Suggestion Discovery Lab</a>
      <p className="eyebrow">PRIVATE INVESTIGATOR TOOLS</p>
      <h1>Data-quality dashboard</h1>
      <p>
        This descriptive report keeps Pilot 1.0 resonance data separate from development versions.
        It does not test efficacy or rank a winning suggestion.
      </p>
      <form className="card" onSubmit={load}>
        <label className="field">
          Investigator export token
          <input
            type="password"
            autoComplete="off"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            required
          />
        </label>
        <p className="fine">
          Use the existing RESEARCH_EXPORT_TOKEN, not the participant access code. The credential
          stays in this page’s memory and is sent in the authorisation header. It is not saved by
          this application.
        </p>
        <label className="field">
          Analysis window
          <select
            value={window}
            onChange={(e) => {
              setWindow(e.target.value as AnalysisWindow);
              setReport(null);
            }}
          >
            <option value="primary">Primary: first Pilot 1.0 session, rounds 1–3</option>
            <option value="all">Secondary: all Pilot 1.0 sessions and rounds</option>
          </select>
        </label>
        <button disabled={busy}>{busy ? 'Loading report…' : 'Load private report'}</button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            setCredential('');
            setReport(null);
            setError('');
          }}
        >
          Clear report and credential
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {report && (
        <>
          <section className="card" aria-label="Report scope">
            <h2>
              {report.pilot.pilotVersion} ·{' '}
              {report.window === 'primary' ? 'Primary window' : 'Secondary window'}
            </h2>
            <p>
              Generated {report.generatedAt}. Session creation cutoff: {report.cutoff}.
            </p>
            <p>
              Scanned {report.counts.scannedSessions} sessions; {report.counts.eligibleSessions}{' '}
              meet the Pilot 1.0 session definition. Earlier versions appear only in the inventory
              below.
            </p>
            {report.truncated && (
              <p role="alert" className="error">
                Partial report: the scan limit of {report.scanLimit} sessions was reached. These are
                not full-dataset totals. Use all pages of the investigator CSV exports for a
                complete analysis.
              </p>
            )}
            <p className="fine">
              This is a live extract, not a frozen snapshot. Active sessions may change during
              loading. Freeze collection and archive a complete extract for analysis. Participant
              IDs may represent returning devices or recovered accounts; they are not proof of
              unique individuals.
            </p>
            <button className="secondary" onClick={download}>
              Download aggregate report
            </button>
          </section>
          <section className="card">
            <h2>Participation and completeness</h2>
            <dl className="quality-counts">
              {Object.entries({
                'Participant IDs': report.counts.participantIds,
                'Selected sessions': report.counts.selectedSessions,
                'Ended sessions': report.counts.endedSessions,
                'Active sessions': report.counts.activeSessions,
                'Complete rounds': report.counts.completeRounds,
                'Partial rounds': report.counts.partialRounds,
                'Generated suggestions': report.counts.generated,
                'Numeric ratings': report.counts.rated,
                'Unable to rate': report.counts.unable,
                'Missing responses': report.counts.missing,
              }).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="fine">
              Ended means the participant explicitly stopped; it does not mean a prescribed dose was
              completed. Missing includes generated suggestions that were never played. Zero is a
              numeric rating, not missing.
            </p>
          </section>
          <section className="card">
            <h2>Six-category resonance summary</h2>
            <p>
              Participant-balanced means average ratings within each participant ID and category
              first, then average those participant means. They are descriptive; account for
              repeated observations in formal analysis.
            </p>
            <div className="research-table">
              <table>
                <caption>Resonance by target and delivery form</caption>
                <thead>
                  <tr>
                    {[
                      'Category',
                      'Generated',
                      'Prepared',
                      'Heard',
                      'Participant IDs with ratings',
                      'Rated',
                      'Zero',
                      'Unable',
                      'Missing',
                      'Invalid',
                      'Participant-balanced mean',
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.cells.map((c) => (
                    <tr key={c.type}>
                      <th scope="row">{label(c.type)}</th>
                      <td>{c.generated}</td>
                      <td>{c.prepared}</td>
                      <td>{c.heard}</td>
                      <td>{c.participantIds}</td>
                      <td>{c.rated}</td>
                      <td>{c.zero}</td>
                      <td>{c.unable}</td>
                      <td>{c.missing}</td>
                      <td>{c.invalid}</td>
                      <td>{display(c.participantBalancedMean)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>Show the full 0–10 distributions</summary>
              <div className="research-table">
                <table>
                  <caption>Counts of numeric resonance ratings</caption>
                  <thead>
                    <tr>
                      <th>Category</th>
                      {Array.from({ length: 11 }, (_, n) => (
                        <th key={n}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.cells.map((c) => (
                      <tr key={c.type}>
                        <th scope="row">{label(c.type)}</th>
                        {c.distribution.map((n, i) => (
                          <td key={i}>{n}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <section className="card">
            <h2>Audio duration</h2>
            <p>
              Seconds include the three-second lead-in, sentence pauses and end tone. The
              approximate target is {report.pilot.audioPolicy.targetMinSeconds}–
              {report.pilot.audioPolicy.targetMaxSeconds} seconds; outliers are flagged, not
              automatically excluded or time-stretched.
            </p>
            <div className="research-table">
              <table>
                <caption>Recorded audio duration in seconds</caption>
                <thead>
                  <tr>
                    {[
                      'Category',
                      'Available recordings',
                      'Minimum',
                      '25th percentile',
                      'Median',
                      '75th percentile',
                      'Maximum',
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.cells.map((c) => (
                    <tr key={c.type}>
                      <th scope="row">{label(c.type)}</th>
                      <td>{c.duration.n}</td>
                      {[
                        c.duration.min,
                        c.duration.p25,
                        c.duration.median,
                        c.duration.p75,
                        c.duration.max,
                      ].map((n, i) => (
                        <td key={i}>{display(n)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>Quality flags</h2>
            <p>
              Flags are review prompts, not automatic participant exclusions. Unprepared recordings
              are not counted as technical failures.
            </p>
            <dl className="quality-counts">
              {Object.entries(report.flags).map(([name, value]) => (
                <div key={name}>
                  <dt>{label(name.replace(/[A-Z]/g, (x) => ` ${x.toLowerCase()}`))}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card">
            <h2>Version inventory</h2>
            <div className="research-table">
              <table>
                <caption>All scanned sessions, kept separate by version and measure</caption>
                <thead>
                  <tr>
                    {['Pilot', 'Protocol', 'Measure', 'Sessions', 'Rounds'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.versions.map((v, i) => (
                    <tr key={i}>
                      <td>{v.pilot}</td>
                      <td>{v.protocol}</td>
                      <td>{v.measure}</td>
                      <td>{v.sessions}</td>
                      <td>{v.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>Observed model and voice configurations</h2>
            <p>
              Review configuration differences before combining records. The requested configuration
              is also saved with each session.
            </p>
            <div className="research-table">
              <table>
                <caption>Actual recorded models and voices in this analysis window</caption>
                <thead>
                  <tr>
                    {['Text model', 'Audio model', 'Voice', 'Suggestions'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.models.map((m, i) => (
                    <tr key={i}>
                      <td>{m.text}</td>
                      <td>{m.audio}</td>
                      <td>{m.voice}</td>
                      <td>{m.suggestions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
