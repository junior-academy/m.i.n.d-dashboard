import fs from "node:fs";
import path from "node:path";
import { parseCSV, toNumber } from "./csv";

export type SubjectResult = {
  subject: number;
  n_train: number;
  n_test: number;
  coverage: number;
  ensemble_threshold_at_coverage: number;
  lda_threshold_at_coverage: number;
  ensemble_acc_matched_coverage: number;
  lda_acc_matched_coverage: number;
  delta_ensemble_minus_lda: number;
  ensemble_acc_all: number;
  lda_acc_all: number;
};

export type RiskCoveragePoint = {
  subject: number;
  decoder: string;
  threshold: number;
  coverage: number;
  risk: number;
  accuracy: number;
};

export type HeadlineStats = {
  n_subjects: number;
  coverage: number;
  mean_ensemble_acc: number;
  mean_lda_acc: number;
  mean_delta_ensemble_minus_lda: number;
  median_delta_ensemble_minus_lda: number;
  wilcoxon_statistic: number;
  wilcoxon_p_greater: number;
  note: string;
};

export type DeltaRow = {
  subject: number;
  delta_ensemble_minus_lda: number;
};

export type DashboardBundle = {
  subjectResults: SubjectResult[];
  riskCoverage: RiskCoveragePoint[];
  headlineStats: HeadlineStats | null;
  deltas: DeltaRow[];
  sourceDir: string;
  hasResults: boolean;
};

const ROOT = process.cwd();
const REPO_ROOT = path.resolve(ROOT, "..");
const MIND_HELDOUT_DIR = path.join(REPO_ROOT, "m.i.n.d", "outputs", "heldout_session");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "mind_data", "heldout_session");

function pickDataFile(fileName: string): string | null {
  const primary = path.join(MIND_HELDOUT_DIR, fileName);
  if (fs.existsSync(primary)) return primary;
  const fallback = path.join(PUBLIC_DATA_DIR, fileName);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function readRows(fileName: string): Record<string, string>[] {
  const p = pickDataFile(fileName);
  if (!p) return [];
  return parseCSV(fs.readFileSync(p, "utf8"));
}

function num(row: Record<string, string>, key: string): number {
  return Number(toNumber(row[key]));
}

export function loadDashboardBundle(): DashboardBundle {
  const subjectResults = readRows("subject_results.csv").map((r) => ({
    subject: num(r, "subject"),
    n_train: num(r, "n_train"),
    n_test: num(r, "n_test"),
    coverage: num(r, "coverage"),
    ensemble_threshold_at_coverage: num(r, "ensemble_threshold_at_coverage"),
    lda_threshold_at_coverage: num(r, "lda_threshold_at_coverage"),
    ensemble_acc_matched_coverage: num(r, "ensemble_acc_matched_coverage"),
    lda_acc_matched_coverage: num(r, "lda_acc_matched_coverage"),
    delta_ensemble_minus_lda: num(r, "delta_ensemble_minus_lda"),
    ensemble_acc_all: num(r, "ensemble_acc_all"),
    lda_acc_all: num(r, "lda_acc_all")
  }));

  const riskCoverage = readRows("risk_coverage.csv").map((r) => ({
    subject: num(r, "subject"),
    decoder: r.decoder ?? "",
    threshold: num(r, "threshold"),
    coverage: num(r, "coverage"),
    risk: num(r, "risk"),
    accuracy: num(r, "accuracy")
  }));

  const headlineRows = readRows("headline_stats.csv");
  const headlineStats =
    headlineRows.length > 0
      ? {
          n_subjects: num(headlineRows[0], "n_subjects"),
          coverage: num(headlineRows[0], "coverage"),
          mean_ensemble_acc: num(headlineRows[0], "mean_ensemble_acc"),
          mean_lda_acc: num(headlineRows[0], "mean_lda_acc"),
          mean_delta_ensemble_minus_lda: num(headlineRows[0], "mean_delta_ensemble_minus_lda"),
          median_delta_ensemble_minus_lda: num(headlineRows[0], "median_delta_ensemble_minus_lda"),
          wilcoxon_statistic: num(headlineRows[0], "wilcoxon_statistic"),
          wilcoxon_p_greater: num(headlineRows[0], "wilcoxon_p_greater"),
          note: headlineRows[0].note ?? ""
        }
      : null;

  const deltas = readRows("per_subject_deltas.csv").map((r) => ({
    subject: num(r, "subject"),
    delta_ensemble_minus_lda: num(r, "delta_ensemble_minus_lda")
  }));

  return {
    subjectResults,
    riskCoverage,
    headlineStats,
    deltas,
    sourceDir: fs.existsSync(MIND_HELDOUT_DIR) ? MIND_HELDOUT_DIR : PUBLIC_DATA_DIR,
    hasResults: subjectResults.length > 0 && headlineStats !== null
  };
}
