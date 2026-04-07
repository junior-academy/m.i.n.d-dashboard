import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Make this script robust regardless of where it's invoked from (repo root, mind-dashboard/, etc.)
const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // mind-dashboard/scripts
const here = path.resolve(scriptDir, ".."); // mind-dashboard

function findRepoRoot(startDir) {
  let cur = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(cur, "m.i.n.d");
    if (fs.existsSync(candidate)) return cur;
    const parent = path.resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

const repoRoot = findRepoRoot(path.resolve(here, "..")) ?? findRepoRoot(process.cwd());
if (!repoRoot) {
  console.warn("[sync] could not locate repo root containing m.i.n.d/");
  process.exit(0);
}

const srcMind = path.join(repoRoot, "m.i.n.d");
const srcEns = path.join(srcMind, "outputs", "ensemble_v2");
const srcVis = path.join(srcMind, "outputs", "visuals");
const srcBase = path.join(srcMind, "outputs");
const srcVal3a = path.join(srcMind, "outputs", "validation_3a");

const outData = path.join(here, "public", "mind_data");
const outData3a = path.join(outData, "validation_3a");
const outVis = path.join(here, "public", "visuals");

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const copy = (src, dst) => {
  if (!fs.existsSync(src)) {
    console.warn("[sync] missing:", src);
    return;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log("[sync] copied:", path.relative(here, dst));
};

ensureDir(outData);
ensureDir(outData3a);
ensureDir(outVis);

// Grid CSVs
for (const f of [
  "LDA_SVM_equal_grid.csv",
  "LDA_SVM_baseline_subject_grid.csv",
  "LDA_SVM_RF_global_grid.csv",
  "LDA_SVM_stacking_grid.csv"
]) {
  copy(path.join(srcEns, f), path.join(outData, f));
}

// Stats tests + baselines
copy(path.join(srcEns, "stats_tests_confident_vs_best.csv"), path.join(outData, "stats_tests_confident_vs_best.csv"));
copy(path.join(srcBase, "classification_results.csv"), path.join(outData, "classification_results.csv"));

// IIIa validation CSVs
copy(
  path.join(
    srcVal3a,
    "ensemble_v2",
    "models-LDA_SVM__weights-equal__feat-fbcsp__ens-softvote__tune-none__cal-sigmoid",
    "threshold_metrics.csv"
  ),
  path.join(outData3a, "LDA_SVM_equal_grid.csv")
);
copy(
  path.join(
    srcVal3a,
    "ensemble_v2",
    "models-LDA_SVM__weights-baseline_subject__feat-fbcsp__ens-softvote__tune-none__cal-sigmoid",
    "threshold_metrics.csv"
  ),
  path.join(outData3a, "LDA_SVM_baseline_subject_grid.csv")
);
copy(
  path.join(srcVal3a, "baselines", "classification_results.csv"),
  path.join(outData3a, "classification_results.csv")
);

// Keeper plots
for (const f of [
  "tradeoff_conf_acc_vs_coverage.png",
  "ensemble_accuracy_confident_vs_threshold.png",
  "paired_ttest_pvalue_vs_threshold.png",
  "mean_diff_conf_vs_best_vs_threshold.png",
  "per_subject_conf_acc_t0.60.png",
  "heatmap_ablation_global_diff_conf_minus_best.png",
  "ensemble_coverage_vs_threshold.png"
]) {
  copy(path.join(srcVis, f), path.join(outVis, f));
}

console.log("[sync] done");
