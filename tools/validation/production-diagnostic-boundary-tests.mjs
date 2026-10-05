/**
 * MINDFLOW-PRODUCTION-BOUNDARY-02 — production/development contract checks.
 *
 * Usage:
 *   node tools/validation/production-diagnostic-boundary-tests.mjs
 *   node tools/validation/production-diagnostic-boundary-tests.mjs --mode=development --base-url=http://127.0.0.1:3000
 *   node tools/validation/production-diagnostic-boundary-tests.mjs --mode=production --base-url=http://127.0.0.1:3000
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { openEvidence } from "./evidence.mjs";

const ROOT = process.cwd();
const EVIDENCE = openEvidence("docs/archive/mindflow-production-boundary-02");
const mode = readArg("mode") ?? "source";
const baseUrl = readArg("base-url")?.replace(/\/$/, "") ?? null;

if (!["source", "development", "production"].includes(mode)) {
  throw new Error(`Unsupported mode: ${mode}`);
}
if (mode !== "source" && !baseUrl) {
  throw new Error(`--base-url is required for ${mode} mode.`);
}

const checks = [];
function check(id, pass, detail) {
  checks.push({ id, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}`);
}

const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const labLayout = read("src/app/lab/layout.tsx");
const launcher = read("src/app/lab/route-launcher/page.tsx");
const lab3dHome = read("src/app/lab/3d-home/page.tsx");
const productHome = read("src/app/page.tsx");
const storageSource = read("src/engine/storage.ts");
const routeRandom = read("src/engine/route-random.ts");
const gameHome3d = read("src/components/three/GameHome3D.tsx");
const worldSelector = read("src/components/three/WorldSelectorScene.tsx");

const boundaryContract = {
  serverComponent: !/^\s*["']use client["']/m.test(labLayout),
  developmentOnly: /process\.env\.NODE_ENV\s*!==\s*["']development["']/.test(
    codeOnly(labLayout),
  ),
  terminatesWithNotFound:
    /from\s+["']next\/navigation["']/.test(labLayout) &&
    /\bnotFound\(\)/.test(codeOnly(labLayout)),
};
check(
  "SERVER_SIDE_LAB_BOUNDARY",
  Object.values(boundaryContract).every(Boolean),
  boundaryContract,
);

const persistenceContract = {
  productUsesPersistentResult: /\bsaveGameResult\(partial\)/.test(
    codeOnly(productHome),
  ),
  launcherUsesTransientResult:
    /\bcreateTransientGameResult\(partial\)/.test(codeOnly(launcher)) &&
    !/\bsaveGameResult\(/.test(codeOnly(launcher)),
  lab3dUsesTransientResult:
    /\bcreateTransientGameResult\(partial\)/.test(codeOnly(lab3dHome)) &&
    !/\bsaveGameResult\(/.test(codeOnly(lab3dHome)),
};
check(
  "EXPLICIT_RESULT_PERSISTENCE_BOUNDARY",
  Object.values(persistenceContract).every(Boolean),
  persistenceContract,
);

const storageRuntime = loadStorageRuntime(storageSource);
const resultInput = {
  activityId: "route-strategy",
  activityTitle: "MindFlow — Rota Estratégica",
  gameId: "escape-maze",
  score: 120,
  summary: "Diagnostic witness",
  details: { won: true, turns: 12 },
};
const writesBeforeTransient = storageRuntime.writes.length;
const transientResult = storageRuntime.api.createTransientGameResult(resultInput);
const writesAfterTransient = storageRuntime.writes.length;
const persistedResult = storageRuntime.api.saveGameResult(resultInput);
const recentResults = storageRuntime.api.getRecentResults();
const storageRuntimeContract = {
  transientResultMaterialized:
    transientResult.gameId === resultInput.gameId &&
    typeof transientResult.id === "string" &&
    typeof transientResult.playedAt === "string",
  transientWrites: writesAfterTransient - writesBeforeTransient,
  persistentWrites: storageRuntime.writes.length - writesAfterTransient,
  normalResultPersisted:
    recentResults.length === 1 && recentResults[0].id === persistedResult.id,
};
check(
  "RESULT_STORAGE_RUNTIME_CONTRACT",
  storageRuntimeContract.transientResultMaterialized &&
    storageRuntimeContract.transientWrites === 0 &&
    storageRuntimeContract.persistentWrites === 1 &&
    storageRuntimeContract.normalResultPersisted,
  storageRuntimeContract,
);

const sourceFiles = walkSourceFiles(path.join(ROOT, "src"));
const seedArmCallers = sourceFiles
  .filter((file) => /\barmRouteRandomSeed\(/.test(codeOnly(fs.readFileSync(file, "utf8"))))
  .map((file) => path.relative(ROOT, file).replaceAll("\\", "/"));
const rngContract = {
  seedArmCallers,
  launcherIsOnlyCaller:
    seedArmCallers.length === 2 &&
    seedArmCallers.includes("src/app/lab/route-launcher/page.tsx") &&
    seedArmCallers.includes("src/engine/route-random.ts"),
  // ROUTE-C7B: the active session owns the seed (a layout effect arms it and its cleanup — on replacement, exit or
  // the page's unmount — disarms it); before C7B a page-level passive effect disarmed on unmount.
  launcherClearsOnUnmount:
    /useEffect\(\(\)\s*=>\s*clearRouteRandomSeed/.test(codeOnly(launcher)) ||
    /useLayoutEffect\(\(\)\s*=>\s*\{\s*if\s*\(session === null\)\s*return;\s*armRouteRandomSeed\(session\.seed\);\s*return clearRouteRandomSeed;\s*\},\s*\[session\]\)/.test(
      codeOnly(launcher),
    ),
  launcherClearsOnExit: /const exitDiagnostic\s*=\s*\(\)\s*=>\s*\{[\s\S]*?clearRouteRandomSeed\(\)/.test(
    codeOnly(launcher),
  ),
  normalFallbackIsMathRandom:
    /return seededDraw \? seededDraw\(\) : Math\.random\(\)/.test(
      codeOnly(routeRandom),
    ),
};
check(
  "SEEDED_RNG_CONTAINMENT_SOURCE",
  Object.values(rngContract).every((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  ),
  rngContract,
);

const r3fContract = {
  labOwnsGameHome3d: /from\s+["']@\/components\/three\/GameHome3D["']/.test(
    lab3dHome,
  ),
  gameHomeOwnsWorldSelector: /\bWorldSelectorScene\b/.test(gameHome3d),
  worldSelectorUsesR3f:
    /from\s+["']@react-three\/fiber["']/.test(worldSelector) &&
    /from\s+["']@react-three\/drei["']/.test(worldSelector),
};
check(
  "LAB_3D_HOME_R3F_OWNER_RETAINED",
  Object.values(r3fContract).every(Boolean),
  r3fContract,
);

const manifestPath = path.join(ROOT, ".next/server/app-paths-manifest.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : null;
const manifestContract = {
  inspected: Boolean(manifest),
  routeLauncherEmitted: Boolean(manifest?.["/lab/route-launcher/page"]),
  lab3dHomeEmitted: Boolean(manifest?.["/lab/3d-home/page"]),
};
check(
  "BUILD_MANIFEST_ROUTE_DISCLOSURE",
  mode === "source" ||
    (manifestContract.inspected &&
      manifestContract.routeLauncherEmitted &&
      manifestContract.lab3dHomeEmitted),
  manifestContract,
);

let httpContract = null;
if (baseUrl) {
  httpContract = await inspectHttpContract(baseUrl, mode);
  check("HTTP_ROUTE_BOUNDARY", httpContract.pass, httpContract);
}

const allPass = checks.every((item) => item.pass);
const evidence = {
  mission: "MINDFLOW-PRODUCTION-BOUNDARY-02",
  mode,
  baseUrl,
  generatedAt: new Date().toISOString(),
  boundaryContract,
  persistenceContract,
  storageRuntimeContract,
  rngContract,
  r3fContract,
  manifestContract,
  httpContract,
  checks,
  allPass,
};
// `generatedAt` is when the run happened, not what it concluded: it is the only
// field that moved between identical verdicts, and it is what made this file
// dirty the worktree on every run.
EVIDENCE.write(`boundary-${mode}.json`, evidence, { metadata: ["generatedAt"] });

console.log(
  `\n${allPass ? "PRODUCTION_DIAGNOSTIC_BOUNDARY_TESTS_OK" : "PRODUCTION_DIAGNOSTIC_BOUNDARY_TESTS_FAILED"}`,
);
process.exitCode = EVIDENCE.finish({ ok: allPass });

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function walkSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function loadStorageRuntime(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const values = new Map();
  const writes = [];
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      const serialized = String(value);
      values.set(key, serialized);
      writes.push({ key, value: serialized });
    },
  };
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    window: { localStorage },
    Date,
    Intl,
  });
  return { api: runtimeModule.exports, writes };
}

async function inspectHttpContract(origin, currentMode) {
  const paths = ["/", "/lab/route-launcher", "/lab/3d-home"];
  const responses = {};

  for (const pathname of paths) {
    const response = await fetch(`${origin}${pathname}`, { redirect: "manual" });
    const body = await response.text();
    const scriptSources = [...body.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    const deliveredScripts = [];
    const inspectDeliveredScripts =
      currentMode === "production" && pathname.startsWith("/lab/");
    if (inspectDeliveredScripts) {
      for (const source of scriptSources) {
        const scriptResponse = await fetch(new URL(source, origin));
        deliveredScripts.push(await scriptResponse.text());
      }
    }
    const deliveredPayload = `${body}\n${deliveredScripts.join("\n")}`;
    responses[pathname] = {
      status: response.status,
      routeLauncherContent: /Route launcher|Bateria sugerida|DIAGNÓSTICO/.test(
        deliveredPayload,
      ),
      lab3dContent: /lab3d-main|GameHome3D/.test(deliveredPayload),
      scriptCount: scriptSources.length,
    };
  }

  const productAvailable = responses["/"].status === 200;
  const labs = [responses["/lab/route-launcher"], responses["/lab/3d-home"]];
  const pass =
    currentMode === "development"
      ? productAvailable && labs.every((result) => result.status === 200)
      : productAvailable &&
        labs.every(
          (result) =>
            result.status === 404 &&
            !result.routeLauncherContent &&
            !result.lab3dContent,
        );

  return { mode: currentMode, responses, pass };
}
