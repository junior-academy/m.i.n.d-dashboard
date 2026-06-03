# M.I.N.D Held-Out Session Dashboard

This Next.js dashboard mirrors the remastered `m.i.n.d` research repo. It displays only the held-out-session evaluation:

- train on `A0xT`
- test once on paired `A0xE`
- equal-weight calibrated LDA+SVM ensemble
- pre-specified LDA comparison
- matched-coverage accuracy, per-subject deltas, Wilcoxon summary, and risk-coverage rows

## Data Source

Local development reads directly from:

```text
../m.i.n.d/outputs/heldout_session/
```

For deploys, `scripts/sync_data.mjs` copies these files into `public/mind_data/heldout_session/`:

- `subject_results.csv`
- `risk_coverage.csv`
- `headline_stats.csv`
- `per_subject_deltas.csv`

## Run

```bash
cd mind-dashboard
npm install
npm run dev
```

If no results appear, first run:

```bash
cd ../m.i.n.d
./run_all.sh
```
