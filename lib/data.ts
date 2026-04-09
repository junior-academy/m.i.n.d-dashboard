import fs from "node:fs";
import path from "node:path";
import { parseCSV, toNumber } from "./csv";

export type GridPoint = {
  subject: number;
  threshold: number;
  ensemble_acc_all: number;
  ensemble_acc_confident: number;
  ensemble_coverage: number;
  toggle_rate?: number;
  wrong_fire_rate_all?: number;
  ensemble_name?: string;
};

export type StatsRow = {
  grid_file: string;
  ensemble_name: string;
  threshold: number;
  mean_coverage: number;
  mean_ens_conf_acc: number;
  mean_best_single_acc: number;
  mean_diff_conf_minus_best: number;
  diff_ci_low_95?: number;
  diff_ci_high_95?: number;
  paired_cohens_d?: number;
  paired_t_pvalue: number;
  levene_pvalue: number;
};

export type BaselineRow = {
  subject: number;
  best_acc: number;
};

export type DashboardData = {
  grids: Record<string, GridPoint[]>;
  baselines: BaselineRow[];
  stats: StatsRow[];
  thresholds: number[];
  moabb?: {
    summary: MoabbSummaryRow[];
    per_subject: MoabbPerSubjectRow[];
    pipeline_stats: MoabbPipelineStatsRow[];
  };
};

export type DashboardBundle = {
  datasets: Record<string, DashboardData>;
};

export type MoabbSummaryRow = {
  pipeline: string;
  score_mean: number;
  score_sd: number;
  n_subjects: number;
};

export type MoabbPerSubjectRow = {
  pipeline: string;
  subject: number;
  score_mean: number;
  score_sd: number;
  n_folds: number;
};

export type MoabbPipelineStatsRow = {
  pipeline_a: string;
  pipeline_b: string;
  n_subjects_used: number;
  mean_a: number;
  mean_b: number;
  mean_diff_a_minus_b: number;
  paired_t_pvalue: number;
  levene_pvalue: number;
  paired_cohens_d: number;
};

// In local dev, repo root is usually one level above `mind-dashboard/`.
// In Vercel builds, we sync required artifacts into `public/mind_data/` during `prebuild`.
const ROOT = process.cwd();
const REPO_ROOT = path.resolve(ROOT, "..");
const MIND_DIR = path.join(REPO_ROOT, "m.i.n.d");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "mind_data");

function readText(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function pickPrimaryOrFallback(primary: string, fallback: string): string {
  return fs.existsSync(primary) ? primary : fallback;
}

function pickFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadGridFromPaths(fileName: string, primary: string, fallback: string, ensembleName?: string): GridPoint[] {
  const p = pickPrimaryOrFallback(primary, fallback);
  if (!fs.existsSync(p)) return [];
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    subject: toNumber(r["subject"]) as unknown as number,
    threshold: toNumber(r["threshold"]) as unknown as number,
    ensemble_acc_all: toNumber(r["ensemble_acc_all"]) as unknown as number,
    ensemble_acc_confident: toNumber(r["ensemble_acc_confident"]) as unknown as number,
    ensemble_coverage: toNumber(r["ensemble_coverage"]) as unknown as number,
    toggle_rate: r["toggle_rate"] ? (toNumber(r["toggle_rate"]) as unknown as number) : Number.NaN,
    wrong_fire_rate_all: r["wrong_fire_rate_all"] ? (toNumber(r["wrong_fire_rate_all"]) as unknown as number) : Number.NaN,
    ensemble_name: r["ensemble_name"] || ensembleName || fileName
  }));
}

function loadBaselinesFromPaths(primary: string, fallback: string): BaselineRow[] {
  const p = pickPrimaryOrFallback(primary, fallback);
  if (!fs.existsSync(p)) return [];
  const rows = parseCSV(readText(p));
  return rows
    .map((r) => ({ subject: toNumber(r["subject"]), best_acc: toNumber(r["best_acc"]) }))
    .filter((r) => Number.isFinite(r.subject) && Number.isFinite(r.best_acc))
    .map((r) => ({ subject: Number(r.subject), best_acc: Number(r.best_acc) }));
}

function loadStatsFromPaths(primary: string, fallback: string): StatsRow[] {
  const p = pickPrimaryOrFallback(primary, fallback);
  if (!fs.existsSync(p)) return [];
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    grid_file: r["grid_file"] || "",
    ensemble_name: r["ensemble_name"] || "",
    threshold: Number(toNumber(r["threshold"])),
    mean_coverage: Number(toNumber(r["mean_coverage"])),
    mean_ens_conf_acc: Number(toNumber(r["mean_ens_conf_acc"])),
    mean_best_single_acc: Number(toNumber(r["mean_best_single_acc"])),
    mean_diff_conf_minus_best: Number(toNumber(r["mean_diff_conf_minus_best"])),
    diff_ci_low_95: r["diff_ci_low_95"] ? Number(toNumber(r["diff_ci_low_95"])) : Number.NaN,
    diff_ci_high_95: r["diff_ci_high_95"] ? Number(toNumber(r["diff_ci_high_95"])) : Number.NaN,
    paired_cohens_d: r["paired_cohens_d"] ? Number(toNumber(r["paired_cohens_d"])) : Number.NaN,
    paired_t_pvalue: Number(toNumber(r["paired_t_pvalue"])),
    levene_pvalue: Number(toNumber(r["levene_pvalue"]))
  }));
}

function loadStatsFromAnyPaths(paths: string[]): StatsRow[] {
  const p = pickFirstExisting(paths);
  if (!p) return [];
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    grid_file: r["grid_file"] || "",
    ensemble_name: r["ensemble_name"] || "",
    threshold: Number(toNumber(r["threshold"])),
    mean_coverage: Number(toNumber(r["mean_coverage"])),
    mean_ens_conf_acc: Number(toNumber(r["mean_ens_conf_acc"])),
    mean_best_single_acc: Number(toNumber(r["mean_best_single_acc"])),
    mean_diff_conf_minus_best: Number(toNumber(r["mean_diff_conf_minus_best"])),
    diff_ci_low_95: r["diff_ci_low_95"] ? Number(toNumber(r["diff_ci_low_95"])) : Number.NaN,
    diff_ci_high_95: r["diff_ci_high_95"] ? Number(toNumber(r["diff_ci_high_95"])) : Number.NaN,
    paired_cohens_d: r["paired_cohens_d"] ? Number(toNumber(r["paired_cohens_d"])) : Number.NaN,
    paired_t_pvalue: Number(toNumber(r["paired_t_pvalue"])),
    levene_pvalue: Number(toNumber(r["levene_pvalue"]))
  }));
}

function loadMoabbSummary(paths: string[]): MoabbSummaryRow[] {
  const p = pickFirstExisting(paths);
  if (!p) return [];
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    pipeline: r["pipeline"] || "",
    score_mean: Number(toNumber(r["score_mean"])),
    score_sd: Number(toNumber(r["score_sd"])),
    n_subjects: Number(toNumber(r["n_subjects"]))
  }));
}

function loadMoabbPerSubject(paths: string[]): MoabbPerSubjectRow[] {
  const p = pickFirstExisting(paths);
  if (!p) return [];
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    pipeline: r["pipeline"] || "",
    subject: Number(toNumber(r["subject"])),
    score_mean: Number(toNumber(r["score_mean"])),
    score_sd: Number(toNumber(r["score_sd"])),
    n_folds: Number(toNumber(r["n_folds"]))
  }));
}

function loadMoabbPipelineStats(paths: string[]): MoabbPipelineStatsRow[] {
  const p = pickFirstExisting(paths);
  if (!p) return [];
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    pipeline_a: r["pipeline_a"] || "",
    pipeline_b: r["pipeline_b"] || "",
    n_subjects_used: Number(toNumber(r["n_subjects_used"])),
    mean_a: Number(toNumber(r["mean_a"])),
    mean_b: Number(toNumber(r["mean_b"])),
    mean_diff_a_minus_b: Number(toNumber(r["mean_diff_a_minus_b"])),
    paired_t_pvalue: Number(toNumber(r["paired_t_pvalue"])),
    levene_pvalue: Number(toNumber(r["levene_pvalue"])),
    paired_cohens_d: Number(toNumber(r["paired_cohens_d"]))
  }));
}

function mergeStats(parts: StatsRow[][]): StatsRow[] {
  const out: StatsRow[] = [];
  const seen = new Set<string>();
  for (const rows of parts) {
    for (const r of rows) {
      const key = `${r.grid_file}::${r.ensemble_name}::${r.threshold}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

function thresholdsFromGrids(grids: Record<string, GridPoint[]>): number[] {
  return Array.from(new Set(Object.values(grids).flatMap((pts) => pts.map((p) => p.threshold))))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
}

function loadDataset2a(): DashboardData {
  const gridFiles = [
    "LDA_SVM_equal_grid.csv",
    "LDA_SVM_baseline_subject_grid.csv",
    "LDA_SVM_RF_global_grid.csv",
    // Debounced stability-controller variants (may be missing; loader will return empty).
    "LDA_SVM_equal_debounced_grid.csv",
    "LDA_SVM_baseline_subject_debounced_grid.csv",
    "LDA_SVM_RF_global_debounced_grid.csv"
  ];
  const grids: Record<string, GridPoint[]> = {};
  for (const f of gridFiles) {
    grids[f] = loadGridFromPaths(
      f,
      path.join(MIND_DIR, "outputs", "ensemble_v2", f),
      path.join(PUBLIC_DATA_DIR, f)
    );
  }

  return {
    grids,
    baselines: loadBaselinesFromPaths(
      path.join(MIND_DIR, "outputs", "classification_results.csv"),
      path.join(PUBLIC_DATA_DIR, "classification_results.csv")
    ),
    stats: loadStatsFromPaths(
      path.join(MIND_DIR, "outputs", "ensemble_v2", "stats_tests_confident_vs_best.csv"),
      path.join(PUBLIC_DATA_DIR, "stats_tests_confident_vs_best.csv")
    ),
    thresholds: thresholdsFromGrids(grids)
  };
}

function loadDataset3a(): DashboardData {
  const grids: Record<string, GridPoint[]> = {
    "LDA_SVM_equal_grid.csv": loadGridFromPaths(
      "LDA_SVM_equal_grid.csv",
      path.join(
        MIND_DIR,
        "outputs",
        "validation_3a",
        "ensemble_v2",
        "models-LDA_SVM__weights-equal__feat-fbcsp__ens-softvote__tune-none__cal-sigmoid",
        "threshold_metrics.csv"
      ),
      path.join(PUBLIC_DATA_DIR, "validation_3a", "LDA_SVM_equal_grid.csv"),
      "IIIa: LDA+SVM (equal)"
    ),
    "LDA_SVM_baseline_subject_grid.csv": loadGridFromPaths(
      "LDA_SVM_baseline_subject_grid.csv",
      path.join(
        MIND_DIR,
        "outputs",
        "validation_3a",
        "ensemble_v2",
        "models-LDA_SVM__weights-baseline_subject__feat-fbcsp__ens-softvote__tune-none__cal-sigmoid",
        "threshold_metrics.csv"
      ),
      path.join(PUBLIC_DATA_DIR, "validation_3a", "LDA_SVM_baseline_subject_grid.csv"),
      "IIIa: LDA+SVM (subj-weights)"
    ),
    // Debounced stability-controller variants (copied by sync script if present).
    "LDA_SVM_equal_debounced_grid.csv": loadGridFromPaths(
      "LDA_SVM_equal_debounced_grid.csv",
      path.join(MIND_DIR, "outputs", "validation_3a", "ensemble_v2", "LDA_SVM_equal_debounced_grid.csv"),
      path.join(PUBLIC_DATA_DIR, "validation_3a", "LDA_SVM_equal_debounced_grid.csv"),
      "IIIa: LDA+SVM (equal, debounced)"
    ),
    "LDA_SVM_baseline_subject_debounced_grid.csv": loadGridFromPaths(
      "LDA_SVM_baseline_subject_debounced_grid.csv",
      path.join(MIND_DIR, "outputs", "validation_3a", "ensemble_v2", "LDA_SVM_baseline_subject_debounced_grid.csv"),
      path.join(PUBLIC_DATA_DIR, "validation_3a", "LDA_SVM_baseline_subject_debounced_grid.csv"),
      "IIIa: LDA+SVM (subj-weights, debounced)"
    )
  };

  const statsEqual = loadStatsFromAnyPaths([
    path.join(MIND_DIR, "outputs", "validation_3a", "ensemble_v2", "stats_tests_confident_vs_best__equal.csv"),
    path.join(MIND_DIR, "outputs", "validation_3a", "ensemble_v2", "stats_tests_confident_vs_best.csv"),
    path.join(PUBLIC_DATA_DIR, "validation_3a", "stats_tests_confident_vs_best__equal.csv"),
    path.join(PUBLIC_DATA_DIR, "validation_3a", "stats_tests_confident_vs_best.csv")
  ]);
  const statsSubj = loadStatsFromAnyPaths([
    path.join(MIND_DIR, "outputs", "validation_3a", "ensemble_v2", "stats_tests_confident_vs_best__baseline_subject.csv"),
    path.join(PUBLIC_DATA_DIR, "validation_3a", "stats_tests_confident_vs_best__baseline_subject.csv")
  ]);

  return {
    grids,
    baselines: loadBaselinesFromPaths(
      path.join(MIND_DIR, "outputs", "validation_3a", "baselines", "classification_results.csv"),
      path.join(PUBLIC_DATA_DIR, "validation_3a", "classification_results.csv")
    ),
    stats: mergeStats([statsEqual, statsSubj]),
    thresholds: thresholdsFromGrids(grids)
  };
}

function loadMoabbPhysionetMi(): DashboardData {
  const base = ["moabb", "physionetmi"];

  const summary = loadMoabbSummary([
    path.join(MIND_DIR, "outputs", ...base, "results_summary.csv"),
    path.join(PUBLIC_DATA_DIR, ...base, "results_summary.csv")
  ]);
  const perSubject = loadMoabbPerSubject([
    path.join(MIND_DIR, "outputs", ...base, "results_per_subject.csv"),
    path.join(PUBLIC_DATA_DIR, ...base, "results_per_subject.csv")
  ]);
  const stats = loadMoabbPipelineStats([
    path.join(MIND_DIR, "outputs", ...base, "stats_tests_pipelines.csv"),
    path.join(PUBLIC_DATA_DIR, ...base, "stats_tests_pipelines.csv")
  ]);

  return {
    grids: {},
    baselines: [],
    stats: [],
    thresholds: [],
    moabb: { summary, per_subject: perSubject, pipeline_stats: stats }
  };
}

function loadMoabbEnsemble(folderName: string): DashboardData {
  const base = ["moabb_ensemble", folderName];
  // Note: LDA-only is treated as a baseline, not an ensemble variant.
  const gridFiles = ["LDA_SVM_equal_grid.csv", "LDA_SVM_subject_grid.csv", "LDA_SVM_RF_equal_grid.csv"];

  const grids: Record<string, GridPoint[]> = {};
  for (const f of gridFiles) {
    grids[f] = loadGridFromPaths(
      f,
      path.join(MIND_DIR, "outputs", ...base, "ensemble_v2", f),
      path.join(PUBLIC_DATA_DIR, ...base, f)
    );
  }

  return {
    grids,
    baselines: loadBaselinesFromPaths(
      path.join(MIND_DIR, "outputs", ...base, "classification_results.csv"),
      path.join(PUBLIC_DATA_DIR, ...base, "classification_results.csv")
    ),
    stats: loadStatsFromPaths(
      path.join(MIND_DIR, "outputs", ...base, "ensemble_v2", "stats_tests_confident_vs_best.csv"),
      path.join(PUBLIC_DATA_DIR, ...base, "stats_tests_confident_vs_best.csv")
    ),
    thresholds: thresholdsFromGrids(grids)
  };
}

export function loadDashboardBundle(): DashboardBundle {
  return {
    datasets: {
      "2a": loadDataset2a(),
      "3a": loadDataset3a(),
      "moabb_ensemble_bnci2014_001": loadMoabbEnsemble("bnci2014_001"),
      "moabb_ensemble_physionetmi": loadMoabbEnsemble("physionetmi")
    }
  };
}
