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

      <div className="topbar">
        <div className="topbar-title">
          SIM_CORE <span>/</span> M.I.N.D RESULTS DASHBOARD
        </div>
        <div className="live-badge">
          <div className="live-dot" />
          LIVE FROM `m.i.n.d/outputs/`
        </div>
      </div>

      <div className="shell">
        <div className="left-col">
          <div className="panel fade-up">
            <div className="panel-header">
              <div className="panel-title">Operating Point</div>
            </div>
            <div className="panel-body">
              <div className="control-row">
                <div className="control-label">Threshold</div>
                <div className="slider-wrap">
                  <input
                    type="range"
                    min={minThr}
                    max={maxThr}
                    step={0.01}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, var(--cyan) ${sliderPct}%, var(--border-hi) ${sliderPct}%)`
                    }}
                  />
                </div>
                <div className="slider-value">
                  selected: <strong>{thr.toFixed(2)}</strong> (snap)
                </div>
              </div>

              <div className="control-row">
                <div className="control-label">Ensemble</div>
                <select value={selectedGrid} onChange={(e) => setSelectedGrid(e.target.value)}>
                  {gridFiles.map((f) => (
                    <option key={f} value={f}>
                      {f.replace("_grid.csv", "")}
                    </option>
                  ))}
                </select>
                <span className="tradeoff-label">tradeoff: accuracy vs coverage</span>
              </div>

              <div className="chart-container">
                <div className="chart-area-label">conf acc</div>
                <svg className="main-chart" viewBox="0 0 540 190" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00e6c8" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#00e6c8" stopOpacity="0.5" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* grid */}
                  {[25, 70, 115, 160].map((y) => (
                    <line key={y} x1="0" y1={y} x2="540" y2={y} stroke="rgba(0,230,200,0.06)" strokeWidth="1" />
                  ))}

                  {/* y labels */}
                  <text x="4" y="28" className="axis-label">
                    1.0
                  </text>
                  <text x="4" y="73" className="axis-label">
                    0.8
                  </text>
                  <text x="4" y="118" className="axis-label">
                    0.6
                  </text>
                  <text x="4" y="163" className="axis-label">
                    0.4
                  </text>

                  {/* tradeoff curve: x=coverage, y=conf acc */}
                  {tradeoffSeries.length > 1 ? (
                    <polyline
                      fill="none"
                      stroke="url(#lineGrad)"
                      strokeWidth="2"
                      filter="url(#glow)"
                      points={tradeoffSeries
                        .map((p) => {
                          const x = 30 + p.cov * 480;
                          const y = 170 - p.acc * 145;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(" ")}
                    />
                  ) : null}

                  {/* current threshold marker */}
                  {currentPoint ? (
                    <>
                      <line
                        x1={30 + currentPoint.cov * 480}
                        y1="18"
                        x2={30 + currentPoint.cov * 480}
                        y2="170"
                        stroke="rgba(255,45,155,0.40)"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                      <circle
                        cx={30 + currentPoint.cov * 480}
                        cy={170 - currentPoint.acc * 145}
                        r="5"
                        fill="var(--magenta)"
                        filter="url(#glow)"
                      />
                      <circle
                        cx={30 + currentPoint.cov * 480}
                        cy={170 - currentPoint.acc * 145}
                        r="9"
                        fill="var(--magenta)"
                        opacity="0.15"
                      />
                      <rect
                        x={Math.max(6, Math.min(480, 30 + currentPoint.cov * 480 - 27))}
                        y="18"
                        width="54"
                        height="16"
                        rx="2"
                        fill="var(--mag-dim)"
                        stroke="var(--magenta)"
                        strokeWidth="0.8"
                      />
                      <text
                        x={Math.max(33, Math.min(507, 30 + currentPoint.cov * 480))}
                        y="30"
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--magenta)"
                        fontFamily="var(--font-head)"
                      >
                        t={thr.toFixed(2)}
                      </text>
                    </>
                  ) : null}

                  <text x="480" y="185" className="axis-label">
                    coverage →
                  </text>
                </svg>
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
                        coverage: <span>{round3(a.meanCoverage)}</span>
                        <br />
                        all-acc: <span>{round3(a.meanAllAcc)}</span>
                        <br />
                        t p: <span>{st ? round3(st.paired_t_pvalue) : "NA"}</span> | Levene p:{" "}
                        <span>{st ? round3(st.levene_pvalue) : "NA"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="panel fade-up">
            <div className="panel-header">
              <div className="panel-title">Per–Subject (Selected Ensemble)</div>
            </div>
            <div className="panel-body" style={{ paddingBottom: 6 }}>
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
                        <td>S{String(r.subject).padStart(2, "0")}</td>
                        <td>{round3(r.bestSingle)}</td>
                        <td>{round3(r.confAcc)}</td>
                        <td>{round3(r.coverage)}</td>
                        <td className={r.diff >= 0 ? "delta-pos" : "delta-neg"}>{round3(r.diff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-note">
                Stats tests come from <code>m.i.n.d/outputs/ensemble_v2/stats_tests_confident_vs_best.csv</code>.
              </div>
            </div>
          </div>
        </div>

        <div className="right-col">
          <div className="panel fade-up">
            <div className="panel-header">
              <div className="panel-title">Pygame Demo</div>
            </div>
            <div className="panel-body">
              <div className="demo-preview">
                <img src="/demo.svg" alt="Pygame demo placeholder" />
              </div>
              <div className="demo-note">
                Replace <code>mind-dashboard/public/demo.svg</code> with a real <code>demo.gif</code> or{" "}
                <code>demo.mp4</code> and update this panel.
              </div>
            </div>
          </div>

          <div className="panel fade-up">
            <div className="panel-header">
              <div className="panel-title">Keeper Plots (Featured)</div>
            </div>
            <div className="panel-body" style={{ paddingTop: 6 }}>
              {rightPlots.map(([label, file]) => (
                <div key={file} className="plot-card">
                  <div className="plot-title">{label}</div>
                  <button
                    className="plotZoomBtn"
                    onClick={() => setZoom({ open: true, src: `/visuals/${encodeURIComponent(file)}`, label })}
                    aria-label={`Zoom plot: ${label}`}
                  >
                    <img className="plot-img" src={`/visuals/${encodeURIComponent(file)}`} alt={label} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bottomPlotsWrap">
        <div className="panel fade-up">
          <div className="panel-header">
            <div className="panel-title">Keeper Plots (All)</div>
          </div>
          <div className="panel-body" style={{ paddingTop: 6 }}>
            <div className="bottomPlotsGrid">
              {bottomPlots.map(([label, file]) => (
                <div key={file} className="plot-card">
                  <div className="plot-title">{label}</div>
                  <button
                    className="plotZoomBtn"
                    onClick={() => setZoom({ open: true, src: `/visuals/${encodeURIComponent(file)}`, label })}
                    aria-label={`Zoom plot: ${label}`}
                  >
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
