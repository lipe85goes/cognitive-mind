/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — what the objectives cost at run time.
 *
 *   renders     the REAL hook on this tree and on the mission's base (32c419a), the same seeded inputs: how many
 *               renders each input costs. Objectives are derived inside the render that already happens and
 *               PORTAL_ACTIVATED records nothing, so the count per input must be the same.
 *   evaluation  `evaluateRouteObjectives` per call (the hook calls it once per render, once more per step and per
 *               Pickaxe break), on real maps.
 *   bundle      with `--next-dir DIR` (a `next build` output), the size of the Home's first-load JS and of the
 *               Rota's lazy chunks (the ones carrying the Rota's code), read from the build manifests; run it on the
 *               base build and the mission build and compare.
 *
 * Usage: node tools/validation/rota2-dependent-objectives-performance.mjs [--next-dir .next] [--json FILE]
 * Writes nothing unless `--json FILE`.
 */
import fs from "node:fs";
import path from "node:path";
import { loadRouteRuntime, cellKey, walkableNeighbours } from "./route-runtime-harness.mjs";

const BASE = "32c419a2784b54043f38f08afd60c8628f44f54c";
const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const NEXT_DIR = arg("--next-dir");
const JSON_OUT = arg("--json");
const report = {};

// --- renders per input ---------------------------------------------------------------------------
const trees = { mission: loadRouteRuntime({ directDifficulty: true }), base: loadRouteRuntime({ directDifficulty: true, rev: BASE }) };
report.renders = {};
for (const [label, rt] of Object.entries(trees)) {
  const row = { games: 0, inputs: 0, renders: 0, byRoute: {} };
  for (const route of [1, 2, 3]) {
    let inputs = 0;
    let renders = 0;
    for (const difficulty of ["easy", "medium", "hard"]) {
      for (let i = 0; i < 8; i += 1) {
        const seed = 7_700_000 + route * 100 + i;
        const run = rt.mount({ seed, difficulty, routeNumber: route });
        const startRenders = run.renders;
        let lcg = seed >>> 0;
        const rand = () => ((lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0) / 2 ** 32);
        let n = 0;
        for (let k = 0; k < 40 && run.state.status === "playing"; k += 1) {
          const g = run.state;
          if (g.rewardChoicePending) run.choose(rand() < 0.5 ? "pickaxe" : "second-chance");
          else {
            const legal = walkableNeighbours(g.player, g.walls);
            const blocked = legal.filter((c) => cellKey(c) !== cellKey(g.guardian) && cellKey(c) !== cellKey(g.sentinel));
            const pool = blocked.length ? blocked : legal;
            if (!pool.length) break;
            run.stepTo(pool[Math.floor(rand() * pool.length)]);
          }
          n += 1;
        }
        row.games += 1;
        inputs += n;
        renders += run.renders - startRenders;
      }
    }
    row.byRoute[route] = { inputs, renders, rendersPerInput: Number((renders / inputs).toFixed(4)) };
    row.inputs += inputs;
    row.renders += renders;
  }
  row.rendersPerInput = Number((row.renders / row.inputs).toFixed(4));
  report.renders[label] = row;
}
report.renders.samePerInput = ["1", "2", "3"].every((r) => report.renders.mission.byRoute[r].rendersPerInput === report.renders.base.byRoute[r].rendersPerInput);

// --- evaluation cost -----------------------------------------------------------------------------
{
  const rt = trees.mission;
  const mod = rt.LAB.graph.require("src/games/escape-maze/route-objectives.ts");
  const inputs = [];
  for (const route of [1, 2, 3]) for (const difficulty of ["easy", "medium", "hard"]) for (let i = 0; i < 20; i += 1) {
    rt.LAB.setSeed(7_800_000 + route * 1000 + i);
    const map = rt.API.generateMaze(difficulty, route);
    inputs.push({ plan: mod.routeObjectivePlan(route), mazeMap: map, collectedStars: map.collectibleStars.slice(0, 2).map(cellKey), walls: map.walls });
  }
  const rounds = 2000;
  for (let r = 0; r < 50; r += 1) for (const input of inputs) mod.evaluateRouteObjectives(input);
  const t0 = performance.now();
  for (let r = 0; r < rounds; r += 1) for (const input of inputs) mod.evaluateRouteObjectives(input);
  const ms = performance.now() - t0;
  report.evaluation = { calls: rounds * inputs.length, microsecondsPerCall: Number(((ms * 1000) / (rounds * inputs.length)).toFixed(3)) };
}

// --- bundle --------------------------------------------------------------------------------------
if (NEXT_DIR) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(NEXT_DIR, file), "utf8"));
  const sizeOf = (files) => files.reduce((n, f) => n + fs.statSync(path.join(NEXT_DIR, f)).size, 0);
  const build = read("build-manifest.json");
  const app = fs.existsSync(path.join(NEXT_DIR, "app-build-manifest.json")) ? read("app-build-manifest.json") : null;
  const homeFiles = [...new Set([...(build.rootMainFiles ?? []), ...(build.polyfillFiles ?? []), ...((app?.pages ?? {})["/page"] ?? []), ...((app?.pages ?? {})["/layout"] ?? [])])].filter((f) => f.endsWith(".js"));
  const chunksDir = path.join(NEXT_DIR, "static", "chunks");
  const allChunks = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".js")) allChunks.push(file);
    }
  };
  walk(chunksDir);
  const rota = allChunks.filter((f) => /Objetivo atual da rota|Rota Estrat/.test(fs.readFileSync(f, "utf8")));
  report.bundle = {
    homeFirstLoadFiles: homeFiles.length,
    homeFirstLoadBytes: homeFiles.length ? sizeOf(homeFiles) : null,
    rotaChunks: rota.map((f) => ({ file: path.relative(NEXT_DIR, f), bytes: fs.statSync(f).size })),
    rotaChunkBytes: rota.reduce((n, f) => n + fs.statSync(f).size, 0),
    note: "homeFirstLoad from the build manifests when present; the Rota chunks are those carrying the Rota component's text",
  };
}

console.log(JSON.stringify(report, null, 2));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.renders.samePerInput ? 0 : 1;
