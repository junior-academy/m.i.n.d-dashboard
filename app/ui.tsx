"use client";

import { useMemo, useState } from "react";
import type { DashboardData, GridPoint, StatsRow } from "@/lib/data";

type Props = { data: DashboardData };

function round3(x: number) {
  if (!Number.isFinite(x)) return "NA";
  return x.toFixed(3);
}

function pickClosest(thresholds: number[], t: number): number {
  if (thresholds.length === 0) return t;
  let best = thresholds[0];
  let bestD = Math.abs(best - t);
  for (const v of thresholds) {
    const d = Math.abs(v - t);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function mean(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return Number.NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function aggregateAt(points: GridPoint[], thr: number) {
  const sub = points.filter((p) => p.threshold === thr);
  return {
    meanCoverage: mean(sub.map((p) => p.ensemble_coverage)),
    meanConfAcc: mean(sub.map((p) => p.ensemble_acc_confident)),
    meanAllAcc: mean(sub.map((p) => p.ensemble_acc_all))
  };
}

function findStats(stats: StatsRow[], gridFile: string, thr: number): StatsRow | undefined {
  return stats.find((r) => r.grid_file === gridFile && r.threshold === thr);
}

export default function DashboardClient({ data }: Props) {
  const [threshold, setThreshold] = useState<number>(0.6);
  const thr = useMemo(() => pickClosest(data.thresholds, threshold), [data.thresholds, threshold]);
  const [selectedGrid, setSelectedGrid] = useState<string>(() => {
    if (data.grids["LDA_SVM_equal_grid.csv"]) return "LDA_SVM_equal_grid.csv";
    const keys = Object.keys(data.grids);
    return keys[0] ?? "LDA_SVM_equal_grid.csv";
  });
  const [zoom, setZoom] = useState<{ open: boolean; src: string; label: string }>({
    open: false,
    src: "",
    label: ""
  });

  const gridFiles = Object.keys(data.grids);
  const agg = useMemo(() => {
    const out: Record<string, ReturnType<typeof aggregateAt>> = {};
    for (const f of gridFiles) out[f] = aggregateAt(data.grids[f], thr);
    return out;
  }, [gridFiles, data.grids, thr]);

  const baselineBySubject = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of data.baselines) m.set(b.subject, b.best_acc);
    return m;
  }, [data.baselines]);

  const perSubjectRows = useMemo(() => {
    const pts = data.grids[selectedGrid] ?? [];
    const sub = pts.filter((p) => p.threshold === thr);
    return sub
      .map((p) => {
        const best = baselineBySubject.get(p.subject);
        const bestNum = best ?? Number.NaN;
        const diff = p.ensemble_acc_confident - bestNum;
        return {
          subject: p.subject,
          confAcc: p.ensemble_acc_confident,
          coverage: p.ensemble_coverage,
          bestSingle: bestNum,
          diff
        };
      })
      .sort((a, b) => a.subject - b.subject);
  }, [baselineBySubject, data.grids, selectedGrid, thr]);

  const tradeoffSeries = useMemo(() => {
    const pts = data.grids[selectedGrid] ?? [];
    const byThr = new Map<number, { cov: number[]; acc: number[] }>();
    for (const p of pts) {
      const cur = byThr.get(p.threshold) ?? { cov: [], acc: [] };
      cur.cov.push(p.ensemble_coverage);
      cur.acc.push(p.ensemble_acc_confident);
      byThr.set(p.threshold, cur);
    }
    const xs = Array.from(byThr.entries())
      .map(([t, v]) => ({ t, cov: mean(v.cov), acc: mean(v.acc) }))
      .filter((r) => Number.isFinite(r.cov) && Number.isFinite(r.acc))
      .sort((a, b) => a.t - b.t);
    return xs;
  }, [data.grids, selectedGrid]);

  const currentPoint = useMemo(() => {
    return tradeoffSeries.find((p) => p.t === thr);
  }, [tradeoffSeries, thr]);

  const plots = [
    ["Accuracy–Coverage Tradeoff", "tradeoff_conf_acc_vs_coverage.png"],
    ["Confident Accuracy vs Threshold", "ensemble_accuracy_confident_vs_threshold.png"],
    ["Paired t-test p-value vs Threshold", "paired_ttest_pvalue_vs_threshold.png"],
    ["Mean(Conf Acc − Best) vs Threshold", "mean_diff_conf_vs_best_vs_threshold.png"],
    ["Per-subject Conf Acc @ 0.60", "per_subject_conf_acc_t0.60.png"],
    ["Heatmap (Ablation Global) ΔConf vs Best", "heatmap_ablation_global_diff_conf_minus_best.png"],
    ["Coverage vs Threshold", "ensemble_coverage_vs_threshold.png"]
  ] as const;

  const rightPlots = plots.slice(0, 2);
  const bottomPlots = plots.slice(2);

  const minThr = Math.min(...data.thresholds, 0);
  const maxThr = Math.max(...data.thresholds, 1);
  const sliderPct = useMemo(() => {
    const denom = maxThr - minThr;
    if (!Number.isFinite(denom) || denom <= 0) return 50;
    const p = ((threshold - minThr) / denom) * 100;
    return Math.max(0, Math.min(100, p));
  }, [maxThr, minThr, threshold]);

  return (
    <>
      {zoom.open ? (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Zoomed plot: ${zoom.label}`}
          onClick={() => setZoom({ open: false, src: "", label: "" })}
          onKeyDown={(e) => {
            if (e.key === "Escape") setZoom({ open: false, src: "", label: "" });
          }}
          tabIndex={-1}
        >
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{zoom.label}</div>
              <button className="modalClose" onClick={() => setZoom({ open: false, src: "", label: "" })}>
                CLOSE
              </button>
            </div>
            <img className="modalImg" src={zoom.src} alt={zoom.label} />
          </div>
        </div>
      ) : null}

      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-mark" />
          <div className="topbar-title">
            <span className="highlight">SIM_CORE</span>
            <span className="sep">/</span>
            M.I.N.D RESULTS DASHBOARD
          </div>
        </div>
        <div className="live-pill">
          <div className="live-dot" />
          LIVE FROM `m.i.n.d/outputs/`
        </div>
      </header>

      <div className="shell">
        {/* LEFT */}
        <div className="col">
          <div className="section">
            <div className="sec-label">Operating Point</div>

            <div className="control-row">
              <div className="ctrl-label">Threshold</div>
              <input
                type="range"
                min={minThr}
                max={maxThr}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, var(--cyan) ${sliderPct}%, var(--border-md) ${sliderPct}%)`
                }}
              />
              <div className="slider-readout">
                selected: <strong>{thr.toFixed(2)}</strong> (snap)
              </div>
            </div>

            <div className="control-row">
              <div className="ctrl-label">Ensemble</div>
              <select value={selectedGrid} onChange={(e) => setSelectedGrid(e.target.value)}>
                {gridFiles.map((f) => (
                  <option key={f} value={f}>
                    {f.replace("_grid.csv", "")}
                  </option>
                ))}
              </select>
              <span className="ctrl-hint">tradeoff: accuracy vs coverage</span>
            </div>

            <div className="chart-wrap">
              <div className="chart-y-label">CONF ACC</div>
              <svg className="main-chart" viewBox="0 0 560 315" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cyanFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
                  </linearGradient>
                  <filter id="softglow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {[21, 95, 168, 242].map((y) => (
                  <line key={y} x1="28" y1={y} x2="555" y2={y} stroke="rgba(0,210,185,0.05)" strokeWidth="1" />
                ))}

                <text x="0" y="28" fontSize="10" fill="var(--text-2)" fontFamily="var(--font-ui)">
                  1.0
                </text>
                <text x="0" y="102" fontSize="10" fill="var(--text-2)" fontFamily="var(--font-ui)">
                  0.8
                </text>
                <text x="0" y="176" fontSize="10" fill="var(--text-2)" fontFamily="var(--font-ui)">
                  0.6
                </text>
                <text x="0" y="250" fontSize="10" fill="var(--text-2)" fontFamily="var(--font-ui)">
                  0.4
                </text>

                {tradeoffSeries.length > 1 ? (
                  <>
                    <polygon
                      fill="url(#cyanFill)"
                      points={[
                        ...tradeoffSeries.map((p) => {
                          const x = 38 + p.cov * 517;
                          const y = 270 - p.acc * 220;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }),
                        "555,315",
                        "38,315"
                      ].join(" ")}
                    />
                    <polyline
                      fill="none"
                      stroke="var(--cyan)"
                      strokeWidth="1.5"
                      filter="url(#softglow)"
                      points={tradeoffSeries
                        .map((p) => {
                          const x = 38 + p.cov * 517;
                          const y = 270 - p.acc * 220;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(" ")}
                    />
                  </>
                ) : null}

                {currentPoint ? (
                  <>
                    <line
                      x1={38 + currentPoint.cov * 517}
                      y1="16"
                      x2={38 + currentPoint.cov * 517}
                      y2="290"
                      stroke="rgba(232,37,122,0.30)"
                      strokeWidth="1"
                      strokeDasharray="4,3"
                    />
                    <circle
                      cx={38 + currentPoint.cov * 517}
                      cy={270 - currentPoint.acc * 220}
                      r="4.5"
                      fill="var(--magenta)"
                      filter="url(#softglow)"
                    />
                    <circle
                      cx={38 + currentPoint.cov * 517}
                      cy={270 - currentPoint.acc * 220}
                      r="9"
                      fill="var(--magenta)"
                      fillOpacity="0.10"
                    />
                    <rect
                      x={Math.max(28, Math.min(491, 38 + currentPoint.cov * 517 - 32))}
                      y="16"
                      width="64"
                      height="24"
                      rx="2"
                      fill="var(--panel)"
                      stroke="var(--magenta)"
                      strokeWidth="0.8"
                      fillOpacity="0.95"
                    />
                    <text
                      x={38 + currentPoint.cov * 517}
                      y="33"
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--magenta)"
                      fontFamily="var(--font-ui)"
                    >
                      t = {thr.toFixed(2)}
                    </text>
                  </>
                ) : null}
              </svg>
              <div className="chart-x-label">coverage →</div>
            </div>

            <div className="ens-grid">
              {gridFiles.map((f) => {
                const a = agg[f];
                const st = findStats(data.stats, f, thr);
                const active = f === selectedGrid;
                return (
                  <button key={f} className={`ens-card ${active ? "active" : ""}`} onClick={() => setSelectedGrid(f)}>
                    <div className="ens-name">{f.replace("_grid.csv", "")}</div>
                    <div className="ens-value">{round3(a.meanConfAcc)}</div>
                    <div className="ens-stats">
                      coverage <b>{round3(a.meanCoverage)}</b>
                      <br />
                      all-acc <b>{round3(a.meanAllAcc)}</b>
                      <br />t p <b>{st ? round3(st.paired_t_pvalue) : "NA"}</b> · Levene <b>{st ? round3(st.levene_pvalue) : "NA"}</b>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="section" style={{ flex: 1 }}>
            <div className="sec-label">Per-Subject · Selected Ensemble</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Best-Single</th>
                    <th>Ens Conf Acc</th>
                    <th>Coverage</th>
                    <th>Δ Conf – Best</th>
                  </tr>
                </thead>
                <tbody>
                  {perSubjectRows.map((r) => (
                    <tr key={r.subject}>
                      <td className="subj">S{String(r.subject).padStart(2, "0")}</td>
                      <td>{round3(r.bestSingle)}</td>
                      <td>{round3(r.confAcc)}</td>
                      <td>{round3(r.coverage)}</td>
                      <td className={r.diff >= 0 ? "pos" : "neg"}>{round3(r.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-note">
              Stats tests sourced from <code>m.i.n.d/outputs/ensemble_v2/stats_tests_confident_vs_best.csv</code>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col">
          <div className="section">
            <div className="sec-label">Pygame Demo</div>
            <div className="demo-frame">
              <img src="/demo.svg" alt="Pygame demo placeholder" />
            </div>
            <div className="demo-caption">
              Replace <code>public/demo.svg</code> with <code>demo.gif</code> or <code>demo.mp4</code> and update this panel.
            </div>
          </div>

          <div className="section" style={{ flex: 1 }}>
            <div className="sec-label">Keeper Plots</div>
            {rightPlots.map(([label, file]) => (
              <div key={file} className="plot-item">
                <div className="plot-title">{label}</div>
                <button className="plotZoomBtn" onClick={() => setZoom({ open: true, src: `/visuals/${encodeURIComponent(file)}`, label })}>
                  <img className="plot-img" src={`/visuals/${encodeURIComponent(file)}`} alt={label} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bottomPlots">
        <div className="bottomPlotsInner">
          <div className="section">
            <div className="sec-label">More Keeper Plots</div>
            <div className="bottomPlotsGrid">
              {bottomPlots.map(([label, file]) => (
                <div key={file} className="plot-item">
                  <div className="plot-title">{label}</div>
                  <button className="plotZoomBtn" onClick={() => setZoom({ open: true, src: `/visuals/${encodeURIComponent(file)}`, label })}>
                    <img className="plot-img" src={`/visuals/${encodeURIComponent(file)}`} alt={label} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
