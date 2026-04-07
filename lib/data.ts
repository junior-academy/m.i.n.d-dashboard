import fs from "node:fs";
import path from "node:path";
import { parseCSV, toNumber } from "./csv";

export type GridPoint = {
  subject: number;
  threshold: number;
  ensemble_acc_all: number;
  ensemble_acc_confident: number;
  ensemble_coverage: number;
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
};

export type DashboardBundle = {
  datasets: Record<string, DashboardData>;
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
    paired_t_pvalue: Number(toNumber(r["paired_t_pvalue"])),
    levene_pvalue: Number(toNumber(r["levene_pvalue"]))
  }));
}

function thresholdsFromGrids(grids: Record<string, GridPoint[]>): number[] {
  return Array.from(new Set(Object.values(grids).flatMap((pts) => pts.map((p) => p.threshold))))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
}

function loadDataset2a(): DashboardData {
  const gridFiles = ["LDA_SVM_equal_grid.csv", "LDA_SVM_baseline_subject_grid.csv", "LDA_SVM_RF_global_grid.csv"];
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
    )
  };

  return {
    grids,
    baselines: loadBaselinesFromPaths(
      path.join(MIND_DIR, "outputs", "validation_3a", "baselines", "classification_results.csv"),
      path.join(PUBLIC_DATA_DIR, "validation_3a", "classification_results.csv")
    ),
    stats: [],
    thresholds: thresholdsFromGrids(grids)
  };
}

export function loadDashboardBundle(): DashboardBundle {
  return {
    datasets: {
      "2a": loadDataset2a(),
      "3a": loadDataset3a()
    }
  };
}
