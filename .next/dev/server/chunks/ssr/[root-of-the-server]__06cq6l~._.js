module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[project]/lib/csv.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseCSV",
    ()=>parseCSV,
    "toNumber",
    ()=>toNumber
]);
function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for(let i = 0; i < line.length; i++){
        const ch = line[i];
        if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === "," && !inQuotes) {
            out.push(cur);
            cur = "";
            continue;
        }
        cur += ch;
    }
    out.push(cur);
    return out.map((s)=>s.trim());
}
function parseCSV(text) {
    const lines = text.split(/\r?\n/).map((l)=>l.trimEnd()).filter((l)=>l.length > 0);
    if (lines.length < 2) return [];
    const header = splitCSVLine(lines[0]);
    const rows = [];
    for (const line of lines.slice(1)){
        const parts = splitCSVLine(line);
        const row = {};
        for(let i = 0; i < header.length; i++){
            row[header[i]] = parts[i] ?? "";
        }
        rows.push(row);
    }
    return rows;
}
function toNumber(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : Number.NaN;
}
}),
"[project]/lib/data.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadDashboardData",
    ()=>loadDashboardData
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/csv.ts [app-rsc] (ecmascript)");
;
;
;
// In local dev, repo root is usually one level above `mind-dashboard/`.
// In Vercel builds, we sync required artifacts into `public/mind_data/` during `prebuild`.
const ROOT = process.cwd();
const REPO_ROOT = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].resolve(ROOT, "..");
const MIND_DIR = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(REPO_ROOT, "m.i.n.d");
const PUBLIC_DATA_DIR = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(ROOT, "public", "mind_data");
function readText(p) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].readFileSync(p, "utf8");
}
function loadGrid(fileName) {
    const primary = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(MIND_DIR, "outputs", "ensemble_v2", fileName);
    const fallback = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(PUBLIC_DATA_DIR, fileName);
    const p = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].existsSync(primary) ? primary : fallback;
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseCSV"])(readText(p));
    return rows.map((r)=>({
            subject: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["subject"]),
            threshold: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["threshold"]),
            ensemble_acc_all: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["ensemble_acc_all"]),
            ensemble_acc_confident: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["ensemble_acc_confident"]),
            ensemble_coverage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["ensemble_coverage"]),
            ensemble_name: r["ensemble_name"] || fileName
        }));
}
function loadBaselines() {
    const primary = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(MIND_DIR, "outputs", "classification_results.csv");
    const fallback = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(PUBLIC_DATA_DIR, "classification_results.csv");
    const p = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].existsSync(primary) ? primary : fallback;
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseCSV"])(readText(p));
    return rows.map((r)=>({
            subject: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["subject"]),
            best_acc: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["best_acc"])
        })).filter((r)=>Number.isFinite(r.subject) && Number.isFinite(r.best_acc)).map((r)=>({
            subject: Number(r.subject),
            best_acc: Number(r.best_acc)
        }));
}
function loadStats() {
    const primary = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(MIND_DIR, "outputs", "ensemble_v2", "stats_tests_confident_vs_best.csv");
    const fallback = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(PUBLIC_DATA_DIR, "stats_tests_confident_vs_best.csv");
    const p = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].existsSync(primary) ? primary : fallback;
    if (!__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].existsSync(p)) return [];
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseCSV"])(readText(p));
    return rows.map((r)=>({
            grid_file: r["grid_file"] || "",
            ensemble_name: r["ensemble_name"] || "",
            threshold: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["threshold"])),
            mean_coverage: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["mean_coverage"])),
            mean_ens_conf_acc: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["mean_ens_conf_acc"])),
            mean_best_single_acc: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["mean_best_single_acc"])),
            mean_diff_conf_minus_best: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["mean_diff_conf_minus_best"])),
            paired_t_pvalue: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["paired_t_pvalue"])),
            levene_pvalue: Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$csv$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toNumber"])(r["levene_pvalue"]))
        }));
}
function loadDashboardData() {
    const gridFiles = [
        "LDA_SVM_equal_grid.csv",
        "LDA_SVM_baseline_subject_grid.csv",
        "LDA_SVM_RF_global_grid.csv"
    ];
    const grids = {};
    for (const f of gridFiles)grids[f] = loadGrid(f);
    const thresholds = Array.from(new Set(Object.values(grids).flatMap((pts)=>pts.map((p)=>p.threshold)))).filter((x)=>Number.isFinite(x)).sort((a, b)=>a - b);
    return {
        grids,
        baselines: loadBaselines(),
        stats: loadStats(),
        thresholds
    };
}
}),
"[project]/app/ui.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/ui.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/ui.tsx <module evaluation>", "default");
}),
"[project]/app/ui.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/app/ui.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/ui.tsx", "default");
}),
"[project]/app/ui.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/ui.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/ui.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Page
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/data.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/ui.tsx [app-rsc] (ecmascript)");
;
;
;
function Page() {
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadDashboardData"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
        data: data
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
}),
"[project]/app/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__06cq6l~._.js.map