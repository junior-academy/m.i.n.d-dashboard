# M.I.N.D Results Dashboard (Vercel)

This is a standalone Next.js app intended for Vercel deployment. It reads your latest outputs directly from:

- `m.i.n.d/outputs/ensemble_v2/*_grid.csv`
- `m.i.n.d/outputs/ensemble_v2/stats_tests_confident_vs_best.csv`
- `m.i.n.d/outputs/classification_results.csv`
- `m.i.n.d/outputs/visuals/*.png`

For Vercel (and other serverless deploys), we **sync** the required CSVs/plots into `mind-dashboard/public/` so they can be served as static assets:

```bash
node scripts/sync_data.mjs
```

This copies:
- CSVs → `mind-dashboard/public/mind_data/`
- keeper plots → `mind-dashboard/public/visuals/` (served at `/visuals/<filename>.png`)

## Local run

From the folder that contains both `m.i.n.d/` and `mind-dashboard/`:

```bash
cd mind-dashboard
npm install
npm run prebuild   # runs scripts/sync_data.mjs
npm run dev
```

## Deploy on Vercel

- Framework preset: Next.js
- Root directory: `mind-dashboard`

### Publish steps (Vercel)

1) Make sure your git repo includes both:
- `mind-dashboard/` (this app)
- `m.i.n.d/outputs/` (so the build can sync CSVs/plots into `public/`)

2) Push to GitHub.

3) In Vercel:
- New Project → Import your GitHub repo
- Root Directory: `mind-dashboard`
- Build Command: default (`next build`) is fine

4) Ensure build-time sync runs:
- `package.json` includes `prebuild` → `node scripts/sync_data.mjs`
- `scripts/sync_data.mjs` copies:
  - `m.i.n.d/outputs/ensemble_v2/*.csv` → `public/mind_data/`
  - `m.i.n.d/outputs/visuals/*.png` → `public/visuals/`

If your repository root is actually `m.i.n.d/` (and `mind-dashboard/` lives outside of it), Vercel won’t see this app. In that case, either:
- move `mind-dashboard/` inside the repo, or
- make a separate repo for `mind-dashboard/` and commit `public/mind_data/` + `public/visuals/` after running `node scripts/sync_data.mjs`.

## Keeper plot paths

These are the 7 “keeper plots” produced by `m.i.n.d/plot_ensembles.py`:

- `m.i.n.d/outputs/visuals/tradeoff_conf_acc_vs_coverage.png` → `/visuals/tradeoff_conf_acc_vs_coverage.png`
- `m.i.n.d/outputs/visuals/ensemble_accuracy_confident_vs_threshold.png` → `/visuals/ensemble_accuracy_confident_vs_threshold.png`
- `m.i.n.d/outputs/visuals/paired_ttest_pvalue_vs_threshold.png` → `/visuals/paired_ttest_pvalue_vs_threshold.png`
- `m.i.n.d/outputs/visuals/mean_diff_conf_vs_best_vs_threshold.png` → `/visuals/mean_diff_conf_vs_best_vs_threshold.png`
- `m.i.n.d/outputs/visuals/per_subject_conf_acc_t0.60.png` → `/visuals/per_subject_conf_acc_t0.60.png`
- `m.i.n.d/outputs/visuals/heatmap_ablation_global_diff_conf_minus_best.png` → `/visuals/heatmap_ablation_global_diff_conf_minus_best.png`
- `m.i.n.d/outputs/visuals/ensemble_coverage_vs_threshold.png` → `/visuals/ensemble_coverage_vs_threshold.png`

## Demo media

Replace `mind-dashboard/public/demo.svg` with a real short `demo.gif` or `demo.mp4` and update `mind-dashboard/app/ui.tsx` accordingly.
