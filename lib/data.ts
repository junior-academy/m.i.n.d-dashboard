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

// In local dev, repo root is usually one level above `mind-dashboard/`.
// In Vercel builds, we sync required artifacts into `public/mind_data/` during `prebuild`.
const ROOT = process.cwd();
const REPO_ROOT = path.resolve(ROOT, "..");
const MIND_DIR = path.join(REPO_ROOT, "m.i.n.d");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "mind_data");

function readText(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function loadGrid(fileName: string): GridPoint[] {
  const primary = path.join(MIND_DIR, "outputs", "ensemble_v2", fileName);
  const fallback = path.join(PUBLIC_DATA_DIR, fileName);
  const p = fs.existsSync(primary) ? primary : fallback;
  const rows = parseCSV(readText(p));
  return rows.map((r) => ({
    subject: toNumber(r["subject"]) as unknown as number,
    threshold: toNumber(r["threshold"]) as unknown as number,
    ensemble_acc_all: toNumber(r["ensemble_acc_all"]) as unknown as number,
    ensemble_acc_confident: toNumber(r["ensemble_acc_confident"]) as unknown as number,
    ensemble_coverage: toNumber(r["ensemble_coverage"]) as unknown as number,
    ensemble_name: r["ensemble_name"] || fileName
  }));
}

function loadBaselines(): BaselineRow[] {
  const primary = path.join(MIND_DIR, "outputs", "classification_results.csv");
  const fallback = path.join(PUBLIC_DATA_DIR, "classification_results.csv");
  const p = fs.existsSync(primary) ? primary : fallback;
  const rows = parseCSV(readText(p));
  return rows
    .map((r) => ({ subject: toNumber(r["subject"]), best_acc: toNumber(r["best_acc"]) }))
    .filter((r) => Number.isFinite(r.subject) && Number.isFinite(r.best_acc))
    .map((r) => ({ subject: Number(r.subject), best_acc: Number(r.best_acc) }));
}

function loadStats(): StatsRow[] {
  const primary = path.join(MIND_DIR, "outputs", "ensemble_v2", "stats_tests_confident_vs_best.csv");
  const fallback = path.join(PUBLIC_DATA_DIR, "stats_tests_confident_vs_best.csv");
  const p = fs.existsSync(primary) ? primary : fallback;
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

export function loadDashboardData(): DashboardData {
  const gridFiles = [
    "LDA_SVM_equal_grid.csv",
    "LDA_SVM_baseline_subject_grid.csv",
    "LDA_SVM_RF_global_grid.csv"
  ];

  const grids: Record<string, GridPoint[]> = {};
  for (const f of gridFiles) grids[f] = loadGrid(f);

  const thresholds = Array.from(
    new Set(Object.values(grids).flatMap((pts) => pts.map((p) => p.threshold)))
  )
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);

  return {
    grids,
    baselines: loadBaselines(),
    stats: loadStats(),
    thresholds
  };
}
