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
const srcVal3aVis = path.join(srcVal3a, "visuals");

const outData = path.join(here, "public", "mind_data");
const outData3a = path.join(outData, "validation_3a");
const outVis = path.join(here, "public", "visuals");
const outVis3a = path.join(outVis, "validation_3a");

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
ensureDir(outVis3a);

// MOABB ensemble (dashboard-ready exports)
const srcMoabbEns = path.join(srcMind, "outputs", "moabb_ensemble");
const outMoabbEns = path.join(outData, "moabb_ensemble");
ensureDir(outMoabbEns);

for (const folder of ["bnci2014_001", "physionetmi"]) {
  const srcFolder = path.join(srcMoabbEns, folder);
  const outFolder = path.join(outMoabbEns, folder);
  ensureDir(outFolder);

  // Grid CSVs + baseline + stats (if present).
  for (const f of [
    "LDA_SVM_equal_grid.csv",
    "LDA_SVM_subject_grid.csv",
    "LDA_SVM_RF_equal_grid.csv",
    "LDA_only_grid.csv",
    "classification_results.csv",
    "stats_tests_confident_vs_best.csv"
  ]) {
    const srcA = path.join(srcFolder, "ensemble_v2", f);
    const srcB = path.join(srcFolder, f);
    const src = fs.existsSync(srcA) ? srcA : srcB;
    copy(src, path.join(outFolder, f));
  }
}

// Grid CSVs
for (const f of [
  "LDA_SVM_equal_grid.csv",
  "LDA_SVM_baseline_subject_grid.csv",
  "LDA_SVM_RF_global_grid.csv",
  "LDA_SVM_stacking_grid.csv",
  // Debounced (stability controller) variants
  "LDA_SVM_equal_debounced_grid.csv",
  "LDA_SVM_baseline_subject_debounced_grid.csv",
  "LDA_SVM_RF_global_debounced_grid.csv"
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

// IIIa debounced grid CSVs (if present)
for (const f of [
  "LDA_SVM_equal_debounced_grid.csv",
  "LDA_SVM_baseline_subject_debounced_grid.csv"
]) {
  copy(path.join(srcVal3a, "ensemble_v2", f), path.join(outData3a, f));
}

// IIIa stats tests (both variants + combined)
copy(
  path.join(srcVal3a, "ensemble_v2", "stats_tests_confident_vs_best__equal.csv"),
  path.join(outData3a, "stats_tests_confident_vs_best__equal.csv")
);
copy(
  path.join(srcVal3a, "ensemble_v2", "stats_tests_confident_vs_best__baseline_subject.csv"),
  path.join(outData3a, "stats_tests_confident_vs_best__baseline_subject.csv")
);
copy(
  path.join(srcVal3a, "ensemble_v2", "stats_tests_confident_vs_best.csv"),
  path.join(outData3a, "stats_tests_confident_vs_best.csv")
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

// IIIa keeper plots (separate folder so 2a and 3a can coexist)
for (const f of [
  "tradeoff_conf_acc_vs_coverage.png",
  "ensemble_accuracy_confident_vs_threshold.png",
  "paired_ttest_pvalue_vs_threshold.png",
  "mean_diff_conf_vs_best_vs_threshold.png",
  "per_subject_conf_acc_t0.60.png",
  "heatmap_ablation_global_diff_conf_minus_best.png",
  "ensemble_coverage_vs_threshold.png"
]) {
  copy(path.join(srcVal3aVis, f), path.join(outVis3a, f));
}

console.log("[sync] done");
