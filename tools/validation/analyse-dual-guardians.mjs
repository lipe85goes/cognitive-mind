/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A — runs the dual-defender design analysis and
 * writes the evidence pack. Analysis only; the runtime is untouched.
 *
 * Usage: node tools/validation/analyse-dual-guardians.mjs [--seeds 40]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  loadLab, structure, objectiveRoute, stats, key,
  DIFFICULTIES, ROUTES, DIFFICULTY_LABEL,
} from "./route-lab.mjs";
import {
  portalZone, simulateDual, dualTrapAnalysis, chestCandidates,
  breakableWallCandidates, classifyFamily, ZONE_RADIUS,
} from "./dual-guardian-lab.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SEEDS = Number(arg("--seeds", 40));
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  console.log("  wrote", name);
};

const lab = loadLab();
const rows = [];
const t0 = Date.now();
const genTimes = [];

console.log(`sweeping ${SEEDS} seeds x 9 combinations...`);
for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let s = 0; s < SEEDS; s += 1) {
      const seed = 4_000 + s * 13 + routeNumber * 211 + DIFFICULTIES.indexOf(difficulty) * 1409;
      const tGen = Date.now();
      const { map, generation } = lab.generate(difficulty, routeNumber, seed);
      genTimes.push({ ms: Date.now() - tGen, attempts: generation.attempts, routeNumber, difficulty });
      const st = structure(map);
      const route = objectiveRoute(map);
      const zone = portalZone(map);
      const traps = dualTrapAnalysis(map, zone);
      const chest = chestCandidates(map, route);
      const breakables = breakableWallCandidates(map, zone);
      const family = classifyFamily(map, zone, breakables, st);
      rows.push({
        routeNumber, difficulty, seed, map, route, structure: st,
        zone, traps, chest, breakables, family,
        templateIndex: generation.templateIndex, fallback: generation.fallback,
      });
    }
  }
}
console.log(`  ${rows.length} maps in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ------------------------------------------------------------ portal zone ---
const zoneRows = rows.map((r) => ({
  route: r.routeNumber, difficulty: r.difficulty, seed: r.seed,
  portalZoneSize: r.zone.portalZoneSize,
  portalAccessCount: r.zone.portalAccessCount,
  portalAccessDistanceMean: r.zone.portalAccessDistance?.mean ?? null,
  portalAccessDiversity: r.zone.portalAccessDiversity,
  sentinelCoveragePotential: r.zone.sentinelCoveragePotential,
  sentinelSingleCellLockRisk: r.zone.sentinelSingleCellLockRisk,
}));
const byCombo = (fn) => {
  const out = {};
  for (const rn of ROUTES) for (const d of DIFFICULTIES) {
    out[`route${rn}-${d}`] = fn(rows.filter((r) => r.routeNumber === rn && r.difficulty === d));
  }
  return out;
};
write("portal-zone-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", zoneRadius: ZONE_RADIUS,
  generatedAt: new Date().toISOString(), samples: rows.length,
  overall: {
    portalZoneSize: stats(zoneRows.map((z) => z.portalZoneSize)),
    portalAccessCount: stats(zoneRows.map((z) => z.portalAccessCount)),
    portalAccessDistanceMean: stats(zoneRows.map((z) => z.portalAccessDistanceMean)),
    portalAccessDiversity: stats(zoneRows.map((z) => z.portalAccessDiversity)),
    sentinelCoveragePotential: stats(zoneRows.map((z) => z.sentinelCoveragePotential)),
    mapsWithOneAccess: zoneRows.filter((z) => z.portalAccessCount <= 1).length,
    mapsWithThreePlusAccess: zoneRows.filter((z) => z.portalAccessCount >= 3).length,
    mapsWithSingleCellLock: zoneRows.filter((z) => z.sentinelSingleCellLockRisk > 0).length,
    mapsFullyCoverableFromOneCell: zoneRows.filter(
      (z) => z.portalAccessCount > 0 && z.sentinelCoveragePotential >= z.portalAccessCount,
    ).length,
  },
  byCombo: byCombo((sub) => ({
    samples: sub.length,
    accessCount: stats(sub.map((r) => r.zone.portalAccessCount)),
    zoneSize: stats(sub.map((r) => r.zone.portalZoneSize)),
    diversity: stats(sub.map((r) => r.zone.portalAccessDiversity)),
  })),
  rows: zoneRows,
});

// ---------------------------------------------------- sentinel comparison ---
console.log("simulating defenders...");
const AGENTS = ["optimal", "cautious", "human", "flawed"];
const sentinelRuns = [];
for (const r of rows.filter((_, i) => i % 2 === 0)) {
  for (const agentKind of AGENTS) {
    const hunterOnly = simulateDual(lab, r.map, r.difficulty, agentKind, { withSentinel: false });
    const withStatic = simulateDual(lab, r.map, r.difficulty, agentKind, { withSentinel: true, sentinelMode: "static" });
    const withTerritorial = simulateDual(lab, r.map, r.difficulty, agentKind, { withSentinel: true, sentinelMode: "territorial", tuning: { patrol: true, commitTurns: 2 } });
    const withTracking = simulateDual(lab, r.map, r.difficulty, agentKind, { withSentinel: true, sentinelMode: "territorial", tuning: { patrol: false, commitTurns: 0 } });
    if (!hunterOnly || !withStatic || !withTerritorial) continue;
    sentinelRuns.push({
      route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, agent: agentKind,
      hunterOnly, withStatic, withTerritorial, withTracking,
    });
  }
}
const rate = (list, pred) => (list.length ? +(list.filter(pred).length / list.length).toFixed(3) : 0);
const summariseMode = (pick) => ({
  won: rate(sentinelRuns, (r) => pick(r).outcome === "won"),
  caughtHunter: rate(sentinelRuns, (r) => pick(r).outcome === "caught-hunter"),
  caughtSentinel: rate(sentinelRuns, (r) => pick(r).outcome === "caught-sentinel"),
  timeout: rate(sentinelRuns, (r) => pick(r).outcome === "timeout"),
  hunterInfluence: stats(sentinelRuns.map((r) => pick(r).hunterInfluence)),
  sentinelInfluence: stats(sentinelRuns.map((r) => pick(r).sentinelInfluence)),
  repositions: stats(sentinelRuns.map((r) => pick(r).sentinelRepositions)),
  turns: stats(sentinelRuns.map((r) => pick(r).turns)),
});
write("sentinel-simulation.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", runs: sentinelRuns.length,
  comparison: {
    hunterOnly: summariseMode((r) => r.hunterOnly),
    sentinelStatic: summariseMode((r) => r.withStatic),
    sentinelTerritorial: summariseMode((r) => r.withTerritorial),
    sentinelTracking: summariseMode((r) => r.withTracking),
  },
  byAgent: Object.fromEntries(AGENTS.map((a) => {
    const sub = sentinelRuns.filter((r) => r.agent === a);
    const rr = (list, pred) => (list.length ? +(list.filter(pred).length / list.length).toFixed(3) : 0);
    return [a, {
      runs: sub.length,
      wonHunterOnly: rr(sub, (r) => r.hunterOnly.outcome === "won"),
      wonTerritorial: rr(sub, (r) => r.withTerritorial.outcome === "won"),
      caughtBySentinel: rr(sub, (r) => r.withTerritorial.outcome === "caught-sentinel"),
      caughtByHunter: rr(sub, (r) => r.withTerritorial.outcome === "caught-hunter"),
      sentinelInfluence: stats(sub.map((r) => r.withTerritorial.sentinelInfluence)),
      hunterInfluence: stats(sub.map((r) => r.withTerritorial.hunterInfluence)),
    }];
  })),
  rows: sentinelRuns.slice(0, 200),
});

// ------------------------------------------------- hunter/sentinel overlap --
const dual = sentinelRuns.map((r) => r.withTerritorial);
write("hunter-sentinel-interactions.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", runs: dual.length,
  hunterInfluencedDecisions: stats(dual.map((d) => d.hunterInfluence)),
  sentinelInfluencedDecisions: stats(dual.map((d) => d.sentinelInfluence)),
  bothThreatenedSameStep: stats(dual.map((d) => d.bothThreatenSame)),
  trappedTurns: stats(dual.map((d) => d.trappedTurns)),
  runsWhereOnlyHunterMattered: dual.filter((d) => d.hunterInfluence > 0 && d.sentinelInfluence === 0).length,
  runsWhereOnlySentinelMattered: dual.filter((d) => d.sentinelInfluence > 0 && d.hunterInfluence === 0).length,
  runsWhereBothMattered: dual.filter((d) => d.hunterInfluence > 0 && d.sentinelInfluence > 0).length,
  runsWhereNeitherMattered: dual.filter((d) => d.hunterInfluence === 0 && d.sentinelInfluence === 0).length,
  runsWithNoEscape: dual.filter((d) => d.trappedTurns > 0).length,
});

// ------------------------------------------------------------------ traps ---
const allTraps = rows.flatMap((r) => r.traps.traps);
write("trap-future-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", maps: rows.length, traps: allTraps.length,
  score: stats(allTraps.map((t) => t.score)),
  hunterDetour: stats(allTraps.map((t) => t.hunterDetour)),
  worthless: allTraps.filter((t) => t.score < 15).length,
  isolatingHunter: allTraps.filter((t) => t.isolatesHunter).length,
  sealingPortal: allTraps.filter((t) => t.sealsPortal).length,
  insidePortalZone: allTraps.filter((t) => t.inPortalZone).length,
  onPortalAccess: allTraps.filter((t) => t.isPortalAccess).length,
  forbiddenPairsTotal: rows.reduce((a, r) => a + r.traps.forbiddenPairs, 0),
  mapsWhereAllTrapsForbidden: rows.filter((r) => r.traps.allTrapsForbidden).length,
  byCombo: byCombo((sub) => ({
    meanScore: stats(sub.flatMap((r) => r.traps.traps.map((t) => t.score))),
    worthless: sub.reduce((a, r) => a + r.traps.worthless, 0),
    forbiddenPairs: sub.reduce((a, r) => a + r.traps.forbiddenPairs, 0),
  })),
});

// ------------------------------------------------------------------ chest ---
write("chest-placement-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", maps: rows.length,
  candidatesPerMap: stats(rows.map((r) => r.chest.length)),
  mapsWithNoCandidate: rows.filter((r) => r.chest.length === 0).length,
  bestDetourCost: stats(rows.map((r) => r.chest[0]?.detourCost ?? null)),
  bestStartDistance: stats(rows.map((r) => r.chest[0]?.startDistance ?? null)),
  rule: {
    offObjectiveRoute: true, minStartDistance: 4, minPortalDistance: 3,
    detourCostRange: [4, 12], neverOnLightOrTrap: true,
  },
  byCombo: byCombo((sub) => ({
    candidates: stats(sub.map((r) => r.chest.length)),
    detour: stats(sub.map((r) => r.chest[0]?.detourCost ?? null)),
  })),
  examples: rows.slice(0, 40).map((r) => ({
    route: r.routeNumber, difficulty: r.difficulty, seed: r.seed,
    top: r.chest.slice(0, 3),
  })),
});

// -------------------------------------------------------- breakable walls ---
const allBreak = rows.flatMap((r) => r.breakables);
write("breakable-wall-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", maps: rows.length,
  candidatesPerMap: stats(rows.map((r) => r.breakables.length)),
  mapsWithNoCandidate: rows.filter((r) => r.breakables.length === 0).length,
  utility: stats(allBreak.map((b) => b.breakableWallUtility)),
  shortcut: stats(allBreak.map((b) => b.shortcut)),
  opensNewPortalDoor: allBreak.filter((b) => b.newPortalDoor).length,
  everRequiredForSolution: allBreak.filter((b) => b.requiredForSolution).length,
  rule: {
    neverRequired: true, minPathAfter: 10, minUtility: 20,
    mustJoinTwoOpenCells: true,
  },
  byCombo: byCombo((sub) => ({
    candidates: stats(sub.map((r) => r.breakables.length)),
    utility: stats(sub.flatMap((r) => r.breakables.map((b) => b.breakableWallUtility))),
  })),
});

// --------------------------------------------------------------- families ---
const famCount = {};
for (const r of rows) {
  famCount[r.family.primary] = (famCount[r.family.primary] ?? 0) + 1;
  for (const t of r.family.tags) famCount[`tag:${t}`] = (famCount[`tag:${t}`] ?? 0) + 1;
}
write("map-family-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", maps: rows.length,
  families: {
    A_DUAS_ROTAS: "rota curta e rota alternativa com custo >= 4 movimentos",
    B_REGIOES_GARGALOS: "corredor de ligação >= 3 com zona do portal de 2+ acessos",
    C_PORTAL_MULTIACESSO: "zona do portal com 3+ acessos úteis",
    D_ATALHO_POTENCIAL: "parede quebrável candidata com utilidade >= 35",
  },
  counts: famCount,
  mapsWithoutIdentity: rows.filter((r) => r.family.primary === "SEM_IDENTIDADE").length,
  mapsWithMultipleTags: rows.filter((r) => r.family.tags.length >= 2).length,
  secondRouteCost: stats(rows.map((r) => r.family.secondRouteCost)),
  byCombo: byCombo((sub) => {
    const c = {};
    for (const r of sub) for (const t of r.family.tags) c[t] = (c[t] ?? 0) + 1;
    return { samples: sub.length, tags: c, secondRouteCost: stats(sub.map((r) => r.family.secondRouteCost)) };
  }),
});

// ------------------------------------------------------------ performance ---
write("generation-performance.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A", samples: genTimes.length,
  maxGenerationAttempts: lab.api.MAX_GENERATION_ATTEMPTS,
  attempts: stats(genTimes.map((g) => g.attempts)),
  milliseconds: stats(genTimes.map((g) => g.ms)),
  worst: [...genTimes].sort((a, b) => b.ms - a.ms).slice(0, 10),
  byCombo: Object.fromEntries(ROUTES.flatMap((rn) => DIFFICULTIES.map((d) => {
    const sub = genTimes.filter((g) => g.routeNumber === rn && g.difficulty === d);
    return [`route${rn}-${d}`, { attempts: stats(sub.map((g) => g.attempts)), ms: stats(sub.map((g) => g.ms)) }];
  }))),
  fallbacks: rows.filter((r) => r.fallback).length,
});

// ----------------------------------------------------------- master report --
write("dual-guardian-map-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A",
  generatedAt: new Date().toISOString(),
  maps: rows.length, seedsPerCombination: SEEDS,
  gates: {
    zeroFallback: rows.every((r) => !r.fallback),
    everyMapHasTwoPlusPortalAccesses: rows.every((r) => r.zone.portalAccessCount >= 2),
    noSentinelSingleCellLock: rows.every((r) => r.zone.sentinelSingleCellLockRisk === 0),
    noTrapIsolatesHunter: allTraps.every((t) => !t.isolatesHunter),
    noTrapSealsPortal: allTraps.every((t) => !t.sealsPortal),
    breakableNeverRequired: allBreak.every((b) => !b.requiredForSolution),
    everyMapHasChestCandidate: rows.every((r) => r.chest.length > 0),
  },
  byCombo: byCombo((sub) => ({
    samples: sub.length,
    portalAccess: stats(sub.map((r) => r.zone.portalAccessCount)),
    objectiveMoves: stats(sub.map((r) => r.route?.moves ?? null)),
    secondRouteCost: stats(sub.map((r) => r.family.secondRouteCost)),
    trapScore: stats(sub.flatMap((r) => r.traps.traps.map((t) => t.score))),
    chestCandidates: stats(sub.map((r) => r.chest.length)),
    breakableCandidates: stats(sub.map((r) => r.breakables.length)),
  })),
});

// ------------------------------------------------------------ review sheets --
console.log("rendering sheets...");
const C = { bg: "#0a1614", wall: "#3a2412", open: "#1d3330", grid: "#0d1f1d", gold: "#d9af63", cream: "#fff2c8", teal: "#4be0d0", red: "#ff6b6b", amber: "#ffb347", blue: "#7fb2ff", green: "#5fce8b" };
function boardSvg(r, opts = {}) {
  const S = 34;
  const W = 9 * S;
  const p = [];
  p.push(`<rect width="${W}" height="${W}" fill="${C.bg}"/>`);
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
    const k = `${row},${col}`;
    const wall = r.map.walls.has(k);
    let fill = wall ? C.wall : C.open;
    if (!wall && opts.zone && r.zone.zoneKeys.has(k)) fill = "#1c3f4a";
    if (!wall && opts.route && (r.route?.cells ?? []).some((c) => key(c) === k)) fill = "#24504a";
    p.push(`<rect x="${col * S}" y="${row * S}" width="${S}" height="${S}" fill="${fill}" stroke="${C.grid}"/>`);
  }
  const dot = (c, colour, label, rad = 9) =>
    `<circle cx="${c.col * S + S / 2}" cy="${c.row * S + S / 2}" r="${rad}" fill="${colour}"/>` +
    (label ? `<text x="${c.col * S + S / 2}" y="${c.row * S + S / 2 + 4}" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#08120f">${label}</text>` : "");
  if (opts.accesses) for (const a of r.zone.accesses) p.push(
    `<rect x="${a.col * S + 4}" y="${a.row * S + 4}" width="${S - 8}" height="${S - 8}" fill="none" stroke="${C.amber}" stroke-width="3"/>`);
  if (opts.breakable) for (const b of r.breakables.slice(0, 3)) {
    const [row, col] = b.cell.split(",").map(Number);
    p.push(`<rect x="${col * S + 3}" y="${row * S + 3}" width="${S - 6}" height="${S - 6}" fill="none" stroke="${C.blue}" stroke-width="3" stroke-dasharray="5 3"/>`);
  }
  if (opts.chest) for (const c of r.chest.slice(0, 3)) {
    const [row, col] = c.cell.split(",").map(Number);
    p.push(dot({ row, col }, C.gold, "B", 8));
  }
  for (const t of r.map.traps) p.push(dot(t, C.red, "", 6));
  for (const l of r.map.collectibleStars) p.push(dot(l, "#ffd23f", "", 6));
  p.push(dot(r.map.playerStart, C.teal, "E"));
  p.push(dot(r.map.guardianStart, "#f7a417", "C"));
  p.push(dot(r.map.exitPosition, C.green, "P"));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">${p.join("")}</svg>`, size: W };
}
const plate = (t, s, w, h = 84) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
  `<rect width="100%" height="100%" rx="16" fill="#102523"/>` +
  `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="15" fill="none" stroke="#a9793e" stroke-width="3"/>` +
  `<text x="24" y="36" fill="${C.cream}" font-family="Georgia, serif" font-size="22" font-weight="700">${t}</text>` +
  `<text x="24" y="62" fill="#a8c6bf" font-family="Arial" font-size="13">${s}</text></svg>`);
const tag = (t, w, h = 34) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
  `<rect width="100%" height="100%" rx="9" fill="#0a1c1a"/><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="none" stroke="#bd8a48" stroke-width="2"/>` +
  `<text x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle" fill="${C.cream}" font-family="Arial" font-size="12" font-weight="700">${t}</text></svg>`);

async function sheet(file, title, sub, picks, opts) {
  if (!picks.length) { console.log("  (skipped", file, "- no example)"); return; }
  const bs = picks.map((r) => boardSvg(r, opts));
  const S = bs[0].size;
  const items = [];
  for (let i = 0; i < picks.length; i += 1) {
    const img = await sharp(Buffer.from(bs[i].svg)).png().toBuffer();
    const x = 22 + i * (S + 14);
    items.push({ input: img, left: x, top: 120 }, { input: tag(picks[i].label, S), left: x, top: 120 + S + 8 });
  }
  await sharp({ create: { width: 44 + picks.length * (S + 14), height: 120 + S + 52, channels: 4, background: { r: 8, g: 20, b: 18, alpha: 1 } } })
    .composite([{ input: plate(title, sub, picks.length * (S + 14) - 14), left: 22, top: 18 }, ...items])
    .png({ compressionLevel: 9 }).toFile(path.join(OUT, file));
  console.log("  wrote", file);
}
const pick = (pred, n = 3) => rows.filter(pred).slice(0, n).map((r) => ({
  ...r, label: `R${r.routeNumber} ${DIFFICULTY_LABEL[r.difficulty]} · ${r.zone.portalAccessCount} acessos`,
}));

await sheet("map-family-a.png", "Família A — duas rotas", "Rota curta e alternativa com custo. E=Explorador C=Caçador P=Portal.", pick((r) => r.family.tags.includes("A_DUAS_ROTAS")), { route: true });
await sheet("map-family-b.png", "Família B — regiões e gargalos", "Corredor de ligação entre regiões, zona do portal com 2+ acessos.", pick((r) => r.family.tags.includes("B_REGIOES_GARGALOS")), { route: true });
await sheet("map-family-c.png", "Família C — portal multiacesso", "Três ou mais portas: o Sentinela não cobre todas de uma célula.", pick((r) => r.family.tags.includes("C_PORTAL_MULTIACESSO")), { zone: true, accesses: true });
await sheet("map-family-d.png", "Família D — atalho potencial", "Tracejado azul: parede candidata a picareta futura. Nunca obrigatória.", pick((r) => r.family.tags.includes("D_ATALHO_POTENCIAL")), { breakable: true });
await sheet("portal-zone-accesses.png", "Zona do portal e suas portas", `Azul: zona (raio ${ZONE_RADIUS}). Contorno âmbar: acesso útil.`, pick((r) => r.zone.portalAccessCount >= 3), { zone: true, accesses: true });
await sheet("dual-pressure-map.png", "Pressão dupla", "Caçador móvel (C) e zona do Sentinela (azul) atuando em eixos distintos.", pick((r) => r.zone.portalAccessCount >= 2, 3), { zone: true, accesses: true, route: true });
await sheet("sentinel-territory-map.png", "Território do Sentinela", "O que ele defende: zona + portas. Ele não persegue fora disso.", pick((r) => r.zone.portalAccessCount >= 2, 3), { zone: true, accesses: true });
await sheet("hunter-pressure-map.png", "Pressão do Caçador", "Rota objetiva destacada; o Caçador cruza-a em movimento.", pick(() => true, 3), { route: true });
await sheet("trap-route-change.png", "Armadilhas e circulação", "Vermelho: armadilha. Pontuada pelo desvio que causaria aos defensores.", pick((r) => r.traps.traps.some((t) => t.score >= 30), 3), { route: true });
await sheet("chest-cost-benefit.png", "Baú futuro — custo de desvio", "Dourado (B): células candidatas fora da rota objetiva.", pick((r) => r.chest.length > 0, 3), { route: true, chest: true });
await sheet("breakable-wall-example.png", "Paredes quebráveis candidatas", "Tracejado azul: abriria atalho ou nova porta, sem ser necessária.", pick((r) => r.breakables.length > 0, 3), { breakable: true, route: true });

console.log("\n=== gates ===");
const g = JSON.parse(fs.readFileSync(path.join(OUT, "dual-guardian-map-analysis.json"), "utf8")).gates;
for (const [k, v] of Object.entries(g)) console.log(` ${v ? "OK  " : "FAIL"} ${k}`);
console.log("\ndone in", ((Date.now() - t0) / 1000).toFixed(1), "s");
