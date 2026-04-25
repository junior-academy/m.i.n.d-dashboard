"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardData, GridPoint, MoabbPipelineStatsRow, MoabbPerSubjectRow, MoabbSummaryRow, StatsRow } from "@/lib/data";

type Props = { datasets: Record<string, DashboardData> };
const DASHBOARD_GITHUB_URL = "https://github.com/junior-academy/m.i.n.d-dashboard";

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

function tCrit95(df: number): number {
  const table: Record<number, number> = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    11: 2.201,
    12: 2.179,
    13: 2.160,
    14: 2.145,
    15: 2.131,
    16: 2.120,
    17: 2.110,
    18: 2.101,
    19: 2.093,
    20: 2.086,
    21: 2.080,
    22: 2.074,
    23: 2.069,
    24: 2.064,
    25: 2.060,
    26: 2.056,
    27: 2.052,
    28: 2.048,
    29: 2.045,
    30: 2.042
  };
  return table[df] ?? 1.96;
}

function ci95Mean(values: number[]): { low: number; high: number } {
  const xs = values.filter((v) => Number.isFinite(v));
  const n = xs.length;
  if (n === 0) return { low: Number.NaN, high: Number.NaN };
  const m = mean(xs);
  if (n < 2) return { low: m, high: m };
  const sd = Math.sqrt(mean(xs.map((v) => (v - m) * (v - m))) * (n / (n - 1))); // unbiased sample sd
  const sem = sd / Math.sqrt(n);
  const t = tCrit95(n - 1);
  return { low: m - t * sem, high: m + t * sem };
}

function pairedCohensD(diffs: number[]): number {
  const xs = diffs.filter((v) => Number.isFinite(v));
  const n = xs.length;
  if (n < 2) return Number.NaN;
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((v) => (v - m) * (v - m))) * (n / (n - 1)));
  if (!Number.isFinite(sd) || sd === 0) return Number.NaN;
  return m / sd;
}

function aggregateAt(points: GridPoint[], thr: number) {
  const sub = points.filter((p) => p.threshold === thr);
  return {
    meanCoverage: mean(sub.map((p) => p.ensemble_coverage)),
    meanConfAcc: mean(sub.map((p) => p.ensemble_acc_confident)),
    meanAllAcc: mean(sub.map((p) => p.ensemble_acc_all)),
    meanToggle: mean(sub.map((p) => p.toggle_rate ?? Number.NaN)),
    meanWrongFireAll: mean(sub.map((p) => p.wrong_fire_rate_all ?? Number.NaN))
  };
}

function selectDebouncedPolicy(points: GridPoint[], alpha: number) {
  // Select controller parameters under a safety constraint.
  // Primary constraint: mean wrong_fire_rate_all <= alpha.
  // Primary objective: maximize mean safe_fire (= coverage - wrong_fire).
  // Secondary objectives: minimize wrong_fire and toggle.
  //
  // If the CSV contains multiple (k,n,off_gap) configs at the same threshold, we treat each (t_on,t_off,k,n)
  // as a separate candidate policy (instead of averaging them together).

  const byCfg = new Map<
    string,
    { t_on: number; t_off: number; k: number; n: number; cov: number[]; wrong: number[]; toggle: number[] }
  >();
  for (const p of points) {
    const t_on = p.threshold;
    const t_off = Number.isFinite(p.t_off as number) ? (p.t_off as number) : Number.NaN;
    const k = Number.isFinite(p.k as number) ? (p.k as number) : Number.NaN;
    const n = Number.isFinite(p.n as number) ? (p.n as number) : Number.NaN;
    const key = `${t_on}::${t_off}::${k}::${n}`;
    const cur = byCfg.get(key) ?? { t_on, t_off, k, n, cov: [], wrong: [], toggle: [] };
    cur.cov.push(p.ensemble_coverage);
    cur.wrong.push(p.wrong_fire_rate_all ?? Number.NaN);
    cur.toggle.push(p.toggle_rate ?? Number.NaN);
    byCfg.set(key, cur);
  }

  const rows = Array.from(byCfg.values())
    .map((v) => {
      const meanCov = mean(v.cov);
      const meanWrong = mean(v.wrong);
      const meanToggle = mean(v.toggle);
      const safeFire = Number.isFinite(meanCov) && Number.isFinite(meanWrong) ? meanCov - meanWrong : Number.NaN;
      return {
        t_on: v.t_on,
        t_off: v.t_off,
        k: v.k,
        n: v.n,
        meanCov,
        meanWrong,
        meanToggle,
        safeFire
      };
    })
    .filter((r) => Number.isFinite(r.t_on))
    .sort((a, b) => a.t_on - b.t_on);

  if (rows.length === 0) {
    return {
      t_on: Number.NaN,
      t_off: Number.NaN,
      k: Number.NaN,
      n: Number.NaN,
      meanCov: Number.NaN,
      meanWrong: Number.NaN,
      meanToggle: Number.NaN,
      safeFire: Number.NaN,
      feasible: false
    };
  }

  const feasible = rows.filter((r) => Number.isFinite(r.meanWrong) && r.meanWrong <= alpha);
  const pool = feasible.length > 0 ? feasible : rows;

  let best = pool[0];
  for (const r of pool.slice(1)) {
    // Primary objective: maximize safe fire. Secondary: minimize wrong-fire. Tertiary: minimize toggle.
    if ((r.safeFire ?? -1) > (best.safeFire ?? -1)) best = r;
    else if (r.safeFire === best.safeFire && (r.meanWrong ?? 1) < (best.meanWrong ?? 1)) best = r;
    else if (r.safeFire === best.safeFire && r.meanWrong === best.meanWrong && (r.meanToggle ?? 1) < (best.meanToggle ?? 1)) best = r;
  }

  return { ...best, feasible: feasible.length > 0 };
}

function findStats(stats: StatsRow[], gridFile: string, thr: number): StatsRow | undefined {
  const exact = stats.find((r) => r.grid_file === gridFile && r.threshold === thr);
  if (exact) return exact;

  // Fallback for stats CSVs that don't include `grid_file` (e.g., single-run validation exports).
  const atThr = stats.filter((r) => r.threshold === thr);
  if (atThr.length === 1) return atThr[0];
  const blankGrid = atThr.find((r) => !r.grid_file);
  return blankGrid;
}

function datasetLabel(k: string): string {
  if (k === "2a") return "BCI IV 2a";
  if (k === "3a") return "BCI IIIa";
  if (k === "moabb_ensemble_bnci2014_001") return "MOABB Ensemble (BNCI2014_001, 4-class)";
  if (k === "moabb_ensemble_physionetmi") return "MOABB Ensemble (PhysionetMI, 2-class)";
  return k;
}

function formatCI(low: number | undefined, high: number | undefined): string {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return "NA";
  return `[${Number(low).toFixed(3)}, ${Number(high).toFixed(3)}]`;
}

function MoabbPanel(props: {
  datasetKeys: string[];
  selectedDataset: string;
  setSelectedDataset: (k: string) => void;
  moabb: { summary: MoabbSummaryRow[]; per_subject: MoabbPerSubjectRow[]; pipeline_stats: MoabbPipelineStatsRow[] };
}) {
  const { datasetKeys, selectedDataset, setSelectedDataset, moabb } = props;

  const pipelines = useMemo(() => {
    const names = Array.from(new Set(moabb.per_subject.map((r) => r.pipeline))).filter((x) => x);
    names.sort();
    return names;
  }, [moabb.per_subject]);

  const subjects = useMemo(() => {
    const ids = Array.from(new Set(moabb.per_subject.map((r) => r.subject))).filter((x) => Number.isFinite(x));
    ids.sort((a, b) => a - b);
    return ids;
  }, [moabb.per_subject]);

  const byKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of moabb.per_subject) m.set(`${r.subject}::${r.pipeline}`, r.score_mean);
    return m;
  }, [moabb.per_subject]);

  const primaryComparison = useMemo(() => {
    const direct = moabb.pipeline_stats.find(
      (r) =>
        (r.pipeline_a === "CSP+LDA" && r.pipeline_b === "CSP+SVM") ||
        (r.pipeline_a === "CSP+SVM" && r.pipeline_b === "CSP+LDA")
    );
    return direct ?? moabb.pipeline_stats[0];
  }, [moabb.pipeline_stats]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-mark" />
          <div className="topbar-title">
            <span className="highlight">JR-ACADEMY-6857</span>
            <span className="sep">/</span>
            M.I.N.D RESULTS DASHBOARD
          </div>
        </div>
        <div className="live-pill">
          <div className="live-dot" />
          LIVE FROM `m.i.n.d/outputs/` · DATASET {selectedDataset.toUpperCase()}
        </div>
        <a className="live-pill" href={DASHBOARD_GITHUB_URL} target="_blank" rel="noreferrer">
          GITHUB: m.i.n.d-dashboard
        </a>
      </header>

      <div className="shell shellSingle">
        <div className="col">
          <div className="section">
            <div className="sec-label">External Validation</div>

            <div className="control-row">
              <div className="ctrl-label">Dataset</div>
              <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)}>
                {datasetKeys.map((k) => (
                  <option key={k} value={k}>
                    {datasetLabel(k)}
                  </option>
                ))}
              </select>
              <span className="ctrl-hint">switch source outputs</span>
            </div>

            <div className="table-note" style={{ marginTop: 10 }}>
              MOABB PhysionetMI external validation uses per-subject CV accuracy for <code>CSP+LDA</code> and <code>CSP+SVM</code>.
            </div>

            {primaryComparison ? (
              <div className="ens-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 14 }}>
                <div className="ens-card active" style={{ cursor: "default" }}>
                  <div className="ens-name">Paired t-test p</div>
                  <div className="ens-value">{round3(primaryComparison.paired_t_pvalue)}</div>
                  <div className="ens-stats">
                    diff <b>{round3(primaryComparison.mean_diff_a_minus_b)}</b>
                    <br />d <b>{round3(primaryComparison.paired_cohens_d)}</b>
                  </div>
                </div>
                <div className="ens-card active" style={{ cursor: "default" }}>
                  <div className="ens-name">Levene p</div>
                  <div className="ens-value">{round3(primaryComparison.levene_pvalue)}</div>
                  <div className="ens-stats">
                    {primaryComparison.pipeline_a} vs <b>{primaryComparison.pipeline_b}</b>
                    <br />n <b>{primaryComparison.n_subjects_used}</b>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="section" style={{ flex: 1 }}>
            <div className="sec-label">MOABB Results</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Mean Acc</th>
                    <th>SD</th>
                    <th>N</th>
                  </tr>
                </thead>
                <tbody>
                  {moabb.summary.map((r) => (
                    <tr key={r.pipeline}>
                      <td className="subj">{r.pipeline}</td>
                      <td>{round3(r.score_mean)}</td>
                      <td>{round3(r.score_sd)}</td>
                      <td>{Number.isFinite(r.n_subjects) ? r.n_subjects : "NA"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {subjects.length > 0 && pipelines.length > 0 ? (
                <>
                  <div className="table-note" style={{ marginTop: 14 }}>
                    Per-subject mean accuracy (CV mean). Diff shown as <code>CSP+LDA − CSP+SVM</code>.
                  </div>
                  <table style={{ marginTop: 6 }}>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        {pipelines.map((p) => (
                          <th key={p}>{p}</th>
                        ))}
                        <th>Δ LDA−SVM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((s) => {
                        const lda = byKey.get(`${s}::CSP+LDA`);
                        const svm = byKey.get(`${s}::CSP+SVM`);
                        const diff = Number.isFinite(lda) && Number.isFinite(svm) ? Number(lda) - Number(svm) : Number.NaN;
                        return (
                          <tr key={s}>
                            <td className="subj">S{String(s).padStart(2, "0")}</td>
                            {pipelines.map((p) => {
                              const v = byKey.get(`${s}::${p}`);
                              return <td key={p}>{Number.isFinite(v) ? round3(Number(v)) : "NA"}</td>;
                            })}
                            <td className={diff >= 0 ? "pos" : "neg"}>{Number.isFinite(diff) ? round3(diff) : "NA"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : null}
            </div>

            <div className="table-note">
              MOABB PhysionetMI view sourced from <code>m.i.n.d/outputs/moabb/physionetmi/</code>.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardClient({ datasets }: Props) {
  const datasetKeys = useMemo(() => Object.keys(datasets), [datasets]);
  const [selectedDataset, setSelectedDataset] = useState<string>(() => (datasets["2a"] ? "2a" : (datasetKeys[0] ?? "2a")));
  const [activeTab, setActiveTab] = useState<"overview" | "graphs">("overview");
  const emptyData: DashboardData = useMemo(
    () => ({ grids: {}, baselines: [], stats: [], thresholds: [] }),
    []
  );
  const data = datasets[selectedDataset] ?? datasets[datasetKeys[0]] ?? emptyData;
  const [threshold, setThreshold] = useState<number>(0.6);
  const [selectedGrid, setSelectedGrid] = useState<string>("LDA_SVM_equal_grid.csv");
  const [zoom, setZoom] = useState<{ open: boolean; src: string; label: string }>({
    open: false,
    src: "",
    label: ""
  });

  useEffect(() => {
    const hasEqual = (data.grids["LDA_SVM_equal_grid.csv"] ?? []).length > 0;
    const firstNonEmptyEnsemble =
      Object.keys(data.grids).find((k) => (data.grids[k] ?? []).length > 0 && !k.includes("debounced")) ?? "";
    const nextGrid = hasEqual ? "LDA_SVM_equal_grid.csv" : firstNonEmptyEnsemble;
    if (nextGrid) setSelectedGrid(nextGrid);
    if (data.thresholds.length > 0) {
      const defaultThr = data.thresholds.includes(0.6) ? 0.6 : data.thresholds[0];
      setThreshold(defaultThr);
    }
  }, [data, selectedDataset]);

  const thr = useMemo(() => pickClosest(data.thresholds, threshold), [data.thresholds, threshold]);
  const gridFiles = Object.keys(data.grids);
  const availableGridFiles = useMemo(
    () => gridFiles.filter((f) => (data.grids[f] ?? []).length > 0),
    [data.grids, gridFiles]
  );
  const ensembleGridFiles = useMemo(
    () => availableGridFiles.filter((f) => !f.includes("debounced")),
    [availableGridFiles]
  );
  const debouncedGridFiles = useMemo(
    () => availableGridFiles.filter((f) => f.includes("debounced")),
    [availableGridFiles]
  );
  const agg = useMemo(() => {
    const out: Record<string, ReturnType<typeof aggregateAt>> = {};
    for (const f of availableGridFiles) out[f] = aggregateAt(data.grids[f], thr);
    return out;
  }, [availableGridFiles, data.grids, thr]);

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

  const baselineMeanAll = useMemo(() => {
    return mean(data.baselines.map((b) => b.best_acc));
  }, [data.baselines]);

  const baselineMeanAtSelection = useMemo(() => {
    return mean(perSubjectRows.map((r) => r.bestSingle));
  }, [perSubjectRows]);

  const lockedCandidateThresholds = useMemo(() => [0.6, 0.65, 0.7, 0.75], []);

  // Locked policy selection (choose t* on 2a only, then evaluate other datasets at that fixed t*).
  const lockedThreshold = useMemo(() => {
    const src = datasets["2a"];
    if (!src) return Number.NaN;
    const pts = src.grids[selectedGrid] ?? [];
    if (pts.length === 0) return Number.NaN;

    // Compute mean delta (conf acc - best) per threshold, and select the best subject to a coverage constraint.
    const baseBySub = new Map<number, number>();
    for (const b of src.baselines) baseBySub.set(b.subject, b.best_acc);

    const byThr = new Map<number, { cov: number[]; delta: number[] }>();
    for (const p of pts) {
      const best = baseBySub.get(p.subject);
      if (!Number.isFinite(best)) continue;
      const cur = byThr.get(p.threshold) ?? { cov: [], delta: [] };
      cur.cov.push(p.ensemble_coverage);
      cur.delta.push(p.ensemble_acc_confident - Number(best));
      byThr.set(p.threshold, cur);
    }
    const rows = Array.from(byThr.entries())
      .map(([t, v]) => ({ t, cov: mean(v.cov), delta: mean(v.delta) }))
      .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.delta) && Number.isFinite(r.cov))
      .sort((a, b) => a.t - b.t);
    if (rows.length === 0) return Number.NaN;

    const C_MIN = 0.45;
    const allowed = rows.filter((r) => lockedCandidateThresholds.includes(Number(r.t)));
    const search = allowed.length > 0 ? allowed : rows;
    const feasible = search.filter((r) => r.cov >= C_MIN);
    const pool = feasible.length > 0 ? feasible : search;
    let best = pool[0];
    for (const r of pool.slice(1)) {
      if (r.delta > best.delta) best = r;
    }
    return best.t;
  }, [datasets, lockedCandidateThresholds, selectedGrid]);

  const lockedThrSnap = useMemo(() => pickClosest(data.thresholds, lockedThreshold), [data.thresholds, lockedThreshold]);
  const lockedAgg = useMemo(() => aggregateAt((data.grids[selectedGrid] ?? []), lockedThrSnap), [data.grids, lockedThrSnap, selectedGrid]);
  const lockedStats = useMemo(() => findStats(data.stats, selectedGrid, lockedThrSnap), [data.stats, lockedThrSnap, selectedGrid]);
  const lockedBestSingleMean = useMemo(
    () => (lockedStats && Number.isFinite(lockedStats.mean_best_single_acc) ? lockedStats.mean_best_single_acc : baselineMeanAll),
    [baselineMeanAll, lockedStats]
  );
  const lockedQuick = useMemo(() => {
    const pts = data.grids[selectedGrid] ?? [];
    const at = pts.filter((p) => p.threshold === lockedThrSnap);
    const diffs = at.map((p) => {
      const best = baselineBySubject.get(p.subject);
      return Number.isFinite(best) ? p.ensemble_acc_confident - Number(best) : Number.NaN;
    });
    const ci = ci95Mean(diffs);
    return { d: pairedCohensD(diffs), ciLow: ci.low, ciHigh: ci.high };
  }, [baselineBySubject, data.grids, lockedThrSnap, selectedGrid]);

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
    ["Coverage vs Threshold", "ensemble_coverage_vs_threshold.png"],
    ["Stability: Toggle Rate vs Threshold", "stability_toggle_rate_vs_threshold.png"],
    ["Stability: Wrong-Fire vs Threshold", "stability_wrong_fire_vs_threshold.png"],
    ["Stability: Safe-Fire vs Threshold", "stability_safe_fire_vs_threshold.png"]
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

  const hideKeeperPlots = selectedDataset.startsWith("moabb_ensemble");
  const visualsBase = selectedDataset.startsWith("moabb_ensemble")
    ? `/visuals/${encodeURIComponent(selectedDataset)}/`
    : selectedDataset === "3a"
      ? "/visuals/validation_3a/"
      : "/visuals/";

  if (data.moabb) {
    return (
      <MoabbPanel
        datasetKeys={datasetKeys}
        selectedDataset={selectedDataset}
        setSelectedDataset={setSelectedDataset}
        moabb={data.moabb}
      />
    );
  }

  if (activeTab === "graphs") {
    const base = visualsBase;
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
              <span className="highlight">JR-ACADEMY-6857</span>
              <span className="sep">/</span>
              M.I.N.D RESULTS DASHBOARD
            </div>
          </div>
          <div className="live-pill">
            <div className="live-dot" />
            LIVE FROM `m.i.n.d/outputs/` · DATASET {selectedDataset.toUpperCase()}
          </div>
          <a className="live-pill" href={DASHBOARD_GITHUB_URL} target="_blank" rel="noreferrer">
            GITHUB: m.i.n.d-dashboard
          </a>
        </header>

        <div className="tabsRow">
          <button className="tabBtn" onClick={() => setActiveTab("overview")}>
            OVERVIEW
          </button>
          <button className="tabBtn tabBtnActive" onClick={() => setActiveTab("graphs")}>
            GRAPHS
          </button>
          <div className="tabsSpacer" />
          <div className="tabsRight">
            <span className="tabsLabel">Dataset</span>
            <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)}>
              {datasetKeys.map((k) => (
                <option key={k} value={k}>
                  {datasetLabel(k)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="graphsShell">
          <div className="graphsDemo">
            <div className="sec-label">Pygame Demo</div>
            <div className="demo-frame demo-frame-lg">
              <video
                className="demo-video"
                src="/demo/demo.mp4"
                autoPlay
                loop
                muted
                playsInline
                controls
              />
            </div>
            <div className="demo-caption">
              Demo video served from <code>public/demo/demo.mp4</code>.
            </div>
          </div>

          <div className="graphsKey">
            <div className="sec-label">Key Plots</div>
            <div className="graphsKeyGrid">
              {rightPlots.map(([label, file]) => (
                <div key={file} className="plot-item">
                  <div className="plot-title">{label}</div>
                  <button
                    className="plotZoomBtn"
                    onClick={() => setZoom({ open: true, src: `${base}${encodeURIComponent(file)}`, label })}
                  >
                    <img className="plot-img" src={`${base}${encodeURIComponent(file)}`} alt={label} />
                  </button>
                </div>
              ))}
            </div>
            <div className="table-note" style={{ marginTop: 10 }}>
              Click any plot to zoom.
            </div>
          </div>

          <div className="graphsBottom">
            <div className="sec-label">More Plots</div>
            <div className="graphsBottomGrid">
              {bottomPlots.map(([label, file]) => (
                <div key={file} className="plot-item">
                  <div className="plot-title">{label}</div>
                  <button
                    className="plotZoomBtn"
                    onClick={() => setZoom({ open: true, src: `${base}${encodeURIComponent(file)}`, label })}
                  >
                    <img className="plot-img" src={`${base}${encodeURIComponent(file)}`} alt={label} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

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
            <span className="highlight">JR-ACADEMY-6857</span>
            <span className="sep">/</span>
            M.I.N.D RESULTS DASHBOARD
          </div>
        </div>
        <div className="live-pill">
          <div className="live-dot" />
          LIVE FROM `m.i.n.d/outputs/` · DATASET {selectedDataset.toUpperCase()}
        </div>
        <a className="live-pill" href={DASHBOARD_GITHUB_URL} target="_blank" rel="noreferrer">
          GITHUB: m.i.n.d-dashboard
        </a>
      </header>

      <div className="tabsRow">
        <button className="tabBtn tabBtnActive" onClick={() => setActiveTab("overview")}>
          OVERVIEW
        </button>
        <button className="tabBtn" onClick={() => setActiveTab("graphs")}>
          GRAPHS
        </button>
      </div>

      <div className="shell shellSingle">
        {/* LEFT */}
        <div className="col">
          <div className="section">
            <div className="sec-label">Operating Point</div>

            <div className="control-row">
              <div className="ctrl-label">Dataset</div>
              <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)}>
                {datasetKeys.map((k) => (
                  <option key={k} value={k}>
                    {datasetLabel(k)}
                  </option>
                ))}
              </select>
              <span className="ctrl-hint">switch source outputs</span>
            </div>

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
                {ensembleGridFiles.map((f) => (
                  <option key={f} value={f}>
                    {f.replace("_grid.csv", "")}
                  </option>
                ))}
              </select>
              <span className="ctrl-hint">tradeoff: accuracy vs coverage</span>
            </div>

            {Number.isFinite(lockedThreshold) && ensembleGridFiles.includes(selectedGrid) ? (
              <div className="ens-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 14 }}>
                <div className="ens-card active" style={{ cursor: "default" }}>
                  <div className="ens-name">Locked Policy (picked on 2a)</div>
                  <div className="ens-value">t* = {Number(lockedThreshold).toFixed(2)}</div>
                  <div className="ens-stats">
                    constraint <b>coverage ≥ 0.45</b>
                    <br />
                    candidates <b>0.60/0.65/0.70/0.75</b>
                    <br />
                    apply once to IIIa/MOABB
                  </div>
                </div>
                <div className="ens-card active" style={{ cursor: "default" }}>
                  <div className="ens-name">This Dataset @ t*</div>
                  <div className="ens-value">{round3(lockedAgg.meanConfAcc)}</div>
                  <div className="ens-stats">
                    Best‑Single mean <b>{round3(lockedBestSingleMean)}</b>
                    <br />
                    coverage <b>{round3(lockedAgg.meanCoverage)}</b>
                    <br />
                    all‑acc <b>{round3(lockedAgg.meanAllAcc)}</b>
                    <br />
                    Δconf-best <b>{lockedStats ? round3(lockedStats.mean_diff_conf_minus_best) : "NA"}</b>
                    <br />
                    p <b>{lockedStats ? round3(lockedStats.paired_t_pvalue) : "NA"}</b> · d{" "}
                    <b>{lockedStats ? round3(lockedStats.paired_cohens_d ?? Number.NaN) : round3(lockedQuick.d)}</b>
                    <br />
                    95% CI{" "}
                    <b>
                      {lockedStats && Number.isFinite(lockedStats.diff_ci_low_95) && Number.isFinite(lockedStats.diff_ci_high_95)
                        ? formatCI(lockedStats.diff_ci_low_95, lockedStats.diff_ci_high_95)
                        : formatCI(lockedQuick.ciLow, lockedQuick.ciHigh)}
                    </b>
                  </div>
                </div>
              </div>
            ) : null}

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

                {Number.isFinite(baselineMeanAtSelection) ? (
                  <>
                    <line
                      x1="38"
                      y1={270 - baselineMeanAtSelection * 220}
                      x2="555"
                      y2={270 - baselineMeanAtSelection * 220}
                      stroke="rgba(232,37,122,0.55)"
                      strokeWidth="1"
                      strokeDasharray="5,4"
                    />
                    <text
                      x="44"
                      y={Math.max(14, 266 - baselineMeanAtSelection * 220)}
                      fontSize="10"
                      fill="var(--magenta)"
                      fontFamily="var(--font-ui)"
                    >
                      baseline {baselineMeanAtSelection.toFixed(3)}
                    </text>
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
              <div className="ens-card baseline-card">
                <div className="ens-name">Best-Single Baseline</div>
                <div className="ens-value">{round3(baselineMeanAtSelection)}</div>
                <div className="ens-stats">
                  selected subjects <b>{perSubjectRows.length}</b>
                  <br />
                  global baseline mean (stats-locked){" "}
                  <b>{round3(findStats(data.stats, selectedGrid, thr)?.mean_best_single_acc ?? baselineMeanAll)}</b>
                  <br />
                  compare with selected ensemble card
                </div>
              </div>
              {ensembleGridFiles.map((f) => {
                const a = agg[f];
                const st = findStats(data.stats, f, thr);
                const active = f === selectedGrid;

                const quick = (() => {
                  const pts = data.grids[f] ?? [];
                  const at = pts.filter((p) => p.threshold === thr);
                  const diffs = at.map((p) => {
                    const best = baselineBySubject.get(p.subject);
                    return Number.isFinite(best) ? p.ensemble_acc_confident - Number(best) : Number.NaN;
                  });
                  const ci = ci95Mean(diffs);
                  return { d: pairedCohensD(diffs), ciLow: ci.low, ciHigh: ci.high };
                })();

                const ciText =
                  st && Number.isFinite(st.diff_ci_low_95) && Number.isFinite(st.diff_ci_high_95)
                    ? formatCI(st.diff_ci_low_95, st.diff_ci_high_95)
                    : formatCI(quick.ciLow, quick.ciHigh);

                const dText = st && Number.isFinite(st.paired_cohens_d) ? round3(Number(st.paired_cohens_d)) : round3(quick.d);

                return (
                  <button key={f} className={`ens-card ${active ? "active" : ""}`} onClick={() => setSelectedGrid(f)}>
                    <div className="ens-name">{f.replace("_grid.csv", "")}</div>
                    <div className="ens-value">{round3(a.meanConfAcc)}</div>
                    <div className="ens-stats">
                      coverage <b>{round3(a.meanCoverage)}</b>
                      <br />
                      all-acc <b>{round3(a.meanAllAcc)}</b>
                      <br />
                      p <b>{st ? round3(st.paired_t_pvalue) : "NA"}</b> · d <b>{dText}</b>
                      <br />
                      CI <b>{ciText}</b>
                    </div>
                  </button>
                );
              })}
            </div>

            {debouncedGridFiles.length > 0 ? (
              <div className="debouncedWrap">
                <div className="debouncedLabel">Stability Controller (Debounced)</div>
                <div className="table-note" style={{ marginTop: 0, marginBottom: 10, fontStyle: "normal" }}>
                  “Debounced” = a device-style smoothing layer applied <b>after</b> model prediction to reduce jitter. It uses{" "}
                  <b>hysteresis</b> (<code>t_on &gt; t_off</code>), <b>k-of-n confirmation</b> (e.g., 3-of-5), and a{" "}
                  <b>latched class</b> while firing.
                  <br />
                  The headline metric here is <b>safe-fire</b> = <code>coverage − wrong-fire</code> (fraction of trials that fired{" "}
                  <b>and</b> were correct). This section is intentionally <b>not</b> directly comparable to ensemble confident accuracy.
                </div>
                <div className="deb-grid">
                  {debouncedGridFiles.map((f) => {
                    const pts = data.grids[f] ?? [];
                    const policy = selectDebouncedPolicy(pts, 0.05);
                    return (
                      <div key={f} className="deb-card">
                        <div className="deb-name">{f.replace("_grid.csv", "")}</div>
                        <div className="deb-value">{round3(policy.safeFire)}</div>
                        <div className="deb-stats">
                          α=0.05 policy{" "}
                          <b>
                            t_on {Number.isFinite(policy.t_on) ? policy.t_on.toFixed(2) : "NA"}
                          </b>{" "}
                          ·{" "}
                          <b>
                            t_off {Number.isFinite(policy.t_off) ? policy.t_off.toFixed(2) : "NA"}
                          </b>{" "}
                          ·{" "}
                          <b>
                            {Number.isFinite(policy.k) && Number.isFinite(policy.n) ? `${Math.round(policy.k)}-of-${Math.round(policy.n)}` : "k/n NA"}
                          </b>
                          <br />
                          safe-fire <b>{round3(policy.safeFire)}</b> · wrong-fire <b>{round3(policy.meanWrong)}</b> · coverage{" "}
                          <b>{round3(policy.meanCov)}</b>
                          <br />
                          toggle <b>{round3(policy.meanToggle)}</b> · feasible{" "}
                          <b>{policy.feasible ? "YES" : "NO (best-effort)"}</b>
                          <br />
                          <span style={{ color: "rgba(232,184,75,0.42)" }}>
                            (stability metrics; not directly comparable to ensemble conf-acc)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
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
              {selectedDataset === "2a" ? (
                <>
                  Stats tests sourced from <code>m.i.n.d/outputs/ensemble_v2/stats_tests_confident_vs_best.csv</code>
                </>
              ) : selectedDataset === "3a" ? (
                <>
                  IIIa view sourced from <code>m.i.n.d/outputs/validation_3a/...</code>.
                </>
              ) : selectedDataset.startsWith("moabb_ensemble") ? (
                <>
                  MOABB ensemble view sourced from <code>m.i.n.d/outputs/moabb_ensemble/...</code>.
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
