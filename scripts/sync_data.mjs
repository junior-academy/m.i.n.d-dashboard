import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(dashboardDir, "..");
const src = path.join(repoRoot, "m.i.n.d", "outputs", "heldout_session");
const dst = path.join(dashboardDir, "public", "mind_data", "heldout_session");

fs.mkdirSync(dst, { recursive: true });

for (const file of ["subject_results.csv", "risk_coverage.csv", "headline_stats.csv", "per_subject_deltas.csv"]) {
  const srcFile = path.join(src, file);
  if (!fs.existsSync(srcFile)) {
    console.warn(`[sync] missing ${path.relative(repoRoot, srcFile)}; run m.i.n.d/run_all.sh to generate it`);
    continue;
  }
  fs.copyFileSync(srcFile, path.join(dst, file));
  console.log(`[sync] copied ${file}`);
}
