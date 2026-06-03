"use client";

import { useMemo } from "react";
import type { DashboardBundle, RiskCoveragePoint } from "@/lib/data";

type Props = { bundle: DashboardBundle };

function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return "NA";
  return x.toFixed(digits);
}

function pct(x: number): string {
  if (!Number.isFinite(x)) return "NA";
  return `${(x * 100).toFixed(1)}%`;
}

function mean(xs: number[]): number {
  const vals = xs.filter(Number.isFinite);
  if (vals.length === 0) return Number.NaN;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function aggregateRiskCoverage(points: RiskCoveragePoint[]) {
  const byKey = new Map<string, { decoder: string; threshold: number; coverage: number[]; risk: number[]; accuracy: number[] }>();
  for (const p of points) {
    const key = `${p.decoder}::${p.threshold}`;
    const row = byKey.get(key) ?? { decoder: p.decoder, threshold: p.threshold, coverage: [], risk: [], accuracy: [] };
    row.coverage.push(p.coverage);
    row.risk.push(p.risk);
    row.accuracy.push(p.accuracy);
    byKey.set(key, row);
  }
  return Array.from(byKey.values())
    .map((r) => ({
      decoder: r.decoder,
      threshold: r.threshold,
      coverage: mean(r.coverage),
      risk: mean(r.risk),
      accuracy: mean(r.accuracy)
    }))
    .sort((a, b) => a.decoder.localeCompare(b.decoder) || a.threshold - b.threshold);
}

export default function DashboardClient({ bundle }: Props) {
  const stats = bundle.headlineStats;
  const riskRows = useMemo(() => aggregateRiskCoverage(bundle.riskCoverage), [bundle.riskCoverage]);
  const positiveDeltas = bundle.deltas.filter((d) => d.delta_ensemble_minus_lda > 0).length;

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-mark" />
          <div className="topbar-title">
            <span className="highlight">M.I.N.D</span>
            <span className="sep">/</span>
            HELD-OUT SESSION DASHBOARD
          </div>
        </div>
        <div className="live-pill">
          <div className="live-dot" />
          SOURCE: {bundle.sourceDir}
        </div>
      </header>

      <main className="heldoutShell">
        <section className="section heroPanel">
          <div className="sec-label">Research Target</div>
          <h1>Calibrated LDA+SVM vs pre-specified LDA on A0xE</h1>
          <p>
            Train feature extractors and decoders on each subject&apos;s `A0xT` session, score once on the paired
            `A0xE` session, and compare both decoders at matched coverage.
          </p>
          {!bundle.hasResults ? (
            <div className="emptyState">
              No held-out results found yet. Run <code>./run_all.sh</code> inside <code>m.i.n.d</code>, then restart or rebuild
              the dashboard.
            </div>
          ) : null}
        </section>

        {stats ? (
          <section className="metricGrid">
            <div className="metricCard">
              <div className="metricLabel">Operating Coverage</div>
              <div className="metricValue">{pct(stats.coverage)}</div>
              <div className="metricSub">pre-registered matched coverage</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Ensemble Accuracy</div>
              <div className="metricValue">{pct(stats.mean_ensemble_acc)}</div>
              <div className="metricSub">mean across {stats.n_subjects} subjects</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">LDA Accuracy</div>
              <div className="metricValue">{pct(stats.mean_lda_acc)}</div>
              <div className="metricSub">same coverage, same subjects</div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Wilcoxon p</div>
              <div className="metricValue">{fmt(stats.wilcoxon_p_greater, 4)}</div>
              <div className="metricSub">one-sided ensemble &gt; LDA</div>
            </div>
          </section>
        ) : null}

        {stats ? (
          <section className="section">
            <div className="sec-label">Headline</div>
            <div className="headlineRow">
              <div>
                <div className="headlineNumber">{fmt(stats.mean_delta_ensemble_minus_lda)}</div>
                <div className="headlineCaption">mean delta, ensemble minus LDA</div>
              </div>
              <div>
                <div className="headlineNumber">{fmt(stats.median_delta_ensemble_minus_lda)}</div>
                <div className="headlineCaption">median paired delta</div>
              </div>
              <div>
                <div className="headlineNumber">
                  {positiveDeltas}/{bundle.deltas.length}
                </div>
                <div className="headlineCaption">subjects with positive delta</div>
              </div>
            </div>
            <p className="note">{stats.note}</p>
          </section>
        ) : null}

        <section className="section">
          <div className="sec-label">Per-Subject Matched-Coverage Results</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Train Trials</th>
                  <th>Test Trials</th>
                  <th>Ensemble</th>
                  <th>LDA</th>
                  <th>Delta</th>
                  <th>Ens Thr</th>
                  <th>LDA Thr</th>
                </tr>
              </thead>
              <tbody>
                {bundle.subjectResults.map((r) => (
                  <tr key={r.subject}>
                    <td className="subj">A{String(r.subject).padStart(2, "0")}</td>
                    <td>{r.n_train}</td>
                    <td>{r.n_test}</td>
                    <td>{pct(r.ensemble_acc_matched_coverage)}</td>
                    <td>{pct(r.lda_acc_matched_coverage)}</td>
                    <td className={r.delta_ensemble_minus_lda >= 0 ? "pos" : "neg"}>{fmt(r.delta_ensemble_minus_lda)}</td>
                    <td>{fmt(r.ensemble_threshold_at_coverage)}</td>
                    <td>{fmt(r.lda_threshold_at_coverage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section">
          <div className="sec-label">Risk-Coverage Curve</div>
          <div className="table-wrap compactTable">
            <table>
              <thead>
                <tr>
                  <th>Decoder</th>
                  <th>Threshold</th>
                  <th>Coverage</th>
                  <th>Risk</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.map((r) => (
                  <tr key={`${r.decoder}-${r.threshold}`}>
                    <td className="subj">{r.decoder}</td>
                    <td>{fmt(r.threshold, 2)}</td>
                    <td>{pct(r.coverage)}</td>
                    <td>{pct(r.risk)}</td>
                    <td>{pct(r.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
