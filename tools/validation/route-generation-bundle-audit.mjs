/**
 * ROUTE-C7C — bundle audit: where does the Rota's generation live in a production build?
 *
 * Reads a `next build` output directory (Turbopack) and follows what the browser would load:
 *
 *   home      the scripts the prerendered Home (`server/app/index.html`) loads — the initial JS;
 *   route     the chunk set the Home's lazy loader fetches for the Rota (the one holding the hook's own message);
 *   worker    the chunk sets of every Turbopack Worker entry the Route set constructs (C7C's generation Worker);
 *   babylon   the chunk set the Route set fetches for the board (the one holding Babylon's version banner).
 *
 * For each: files, raw and gzip bytes, and whether generation is in it — located by its unique error literal, which
 * only `generateMaze` carries. Writes nothing.
 *
 * Usage: node tools/validation/route-generation-bundle-audit.mjs [--dir .next] [--label NAME] [--json] [--gate]
 *   --gate  exit 1 unless generation is in a Worker set and in neither the Home's initial JS nor the Route set, and
 *           Babylon is in neither the Home nor the Route set (still lazy).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const DIR = arg("--dir", ".next");
const LABEL = arg("--label", DIR);
const GENERATION = "Route map generation failed all gates";
const HOOK = "observe a rota e colete as luzes";
const BABYLON = "Babylon.js v";

const file = (rel) => path.join(DIR, rel.replace(/^\/?_next\//, ""));
const cache = new Map();
const read = (rel) => {
  if (!cache.has(rel)) cache.set(rel, fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), "utf8") : "");
  return cache.get(rel);
};
const sizes = (list) => {
  const raw = list.reduce((n, f) => n + Buffer.byteLength(read(f)), 0);
  const gzip = list.reduce((n, f) => n + zlib.gzipSync(read(f), { level: 9 }).length, 0);
  return { files: list.length, raw, gzip };
};
const has = (list, needle) => list.filter((f) => read(f).includes(needle));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const html = fs.readFileSync(path.join(DIR, "server/app/index.html"), "utf8");
const home = [...new Set([...html.matchAll(/src="\/_next\/(static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))];

/** Every lazy chunk set a list of chunks can load: `Promise.all([...].map(l)).then(() => require(id))`. */
const lazySets = (list) =>
  list.flatMap((f) =>
    [...read(f).matchAll(/Promise\.all\(\[([^\]]*)\]\.map\(/g)].map((m) => [...m[1].matchAll(/"(static\/chunks\/[^"]+\.js)"/g)].map((x) => x[1])),
  );
const route = lazySets(home).find((set) => has(set, HOOK).length) ?? [];
const workers = route.flatMap((f) =>
  [...read(f).matchAll(/"(static\/chunks\/turbopack-worker-[^"]+\.js)",\[([^\]]*)\]/g)].map((m) => [m[1], ...[...m[2].matchAll(/"(static\/chunks\/[^"]+\.js)"/g)].map((x) => x[1])]),
);
/** The first lazy set reachable from `start` (through nested lazy loaders) that holds `needle`. */
function reachableSet(start, needle) {
  const seen = new Set(start);
  const queue = [start];
  while (queue.length) {
    for (const set of lazySets(queue.shift())) {
      if (has(set, needle).length) return set;
      const fresh = set.filter((f) => !seen.has(f));
      fresh.forEach((f) => seen.add(f));
      if (fresh.length) queue.push(fresh);
    }
  }
  return [];
}
const babylon = reachableSet(route, BABYLON);
const worker = [...new Set(workers.flat())];

const rows = {
  home: { ...sizes(home), generation: has(home, GENERATION), babylon: has(home, BABYLON).length > 0 },
  route: { ...sizes(route), generation: has(route, GENERATION), babylon: has(route, BABYLON).length > 0, hookChunk: has(route, HOOK) },
  worker: { ...sizes(worker), entries: workers.length, generation: has(worker, GENERATION), files: worker },
  babylon: { ...sizes(babylon), generation: has(babylon, GENERATION) },
};
/**
 * Modules (Turbopack factories, keyed by their id list) present in both the Route set and the Worker set: what the two
 * realms each carry a copy of. Sizes are the factories' minified text.
 */
function factories(list) {
  const out = new Map();
  for (const f of list) {
    const text = read(f);
    const starts = [...text.matchAll(/[,[](\d+(?:,\d+)*),(\w)=>\{/g)].map((m) => ({ ids: m[1], at: m.index }));
    starts.forEach((m, i) => out.set(m.ids, { file: f, bytes: (starts[i + 1]?.at ?? text.length) - m.at, exports: [...text.slice(m.at, starts[i + 1]?.at ?? text.length).matchAll(/"([A-Za-z_$][\w$]*)",0,/g)].map((x) => x[1]).slice(0, 6) }));
  }
  return out;
}
const routeModules = factories(route);
const shared = [...factories(worker)].filter(([ids]) => routeModules.has(ids)).map(([ids, m]) => ({ ids, bytes: m.bytes, exports: m.exports }));
rows.shared = { modules: shared.length, raw: shared.reduce((n, m) => n + m.bytes, 0), list: shared };

const everywhere = fs.readdirSync(path.join(DIR, "static/chunks")).filter((f) => f.endsWith(".js")).map((f) => `static/chunks/${f}`);
const generationChunks = has(everywhere, GENERATION).map((f) => ({ file: f, ...sizes([f]) }));
const report = { label: LABEL, dir: DIR, ...rows, generationChunksInBuild: generationChunks };

if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`bundle audit · ${LABEL}`);
  for (const [name, r] of Object.entries(rows).filter(([name]) => name !== "shared")) {
    console.log(
      `  ${name.padEnd(8)} ${String(r.files.length ?? r.files).padStart(3)} files · ${kb(r.raw).padStart(10)} raw · ${kb(r.gzip).padStart(9)} gzip · generation: ${r.generation.length ? r.generation.join(", ") : "no"}` +
        (name === "worker" ? ` · ${r.entries} worker entr${r.entries === 1 ? "y" : "ies"}` : ""),
    );
  }
  console.log(`  shared   ${rows.shared.modules} module groups in both the Route and the Worker sets · ${kb(rows.shared.raw)} raw: ${rows.shared.list.map((m) => `[${m.exports.join(", ")}] ${kb(m.bytes)}`).join("; ")}`);
  console.log(`  generation literal in: ${generationChunks.map((c) => `${c.file} (${kb(c.raw)} raw, ${kb(c.gzip)} gzip)`).join("; ") || "nowhere"}`);
}

if (process.argv.includes("--gate")) {
  const failures = [];
  if (!rows.worker.generation.length) failures.push("generation is in no Worker set");
  if (rows.home.generation.length) failures.push("generation is in the Home's initial JS");
  if (rows.route.generation.length) failures.push("generation is in the Route's main-thread set");
  if (rows.home.babylon || rows.route.babylon) failures.push("Babylon is no longer lazy");
  if (!route.length) failures.push("no Route set found");
  console.log(failures.length ? `GATE FAILED: ${failures.join("; ")}` : "gate held");
  process.exitCode = failures.length ? 1 : 0;
}
