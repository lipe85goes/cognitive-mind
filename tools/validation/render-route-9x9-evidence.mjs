import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const evidenceDir = path.join(root, "docs", "archive", "route-9x9-validation-01");
const report = JSON.parse(
  await fs.readFile(path.join(evidenceDir, "route-9x9-validation.json"), "utf8"),
);
const live = JSON.parse(
  await fs.readFile(path.join(evidenceDir, "route-live-validation.json"), "utf8"),
);
const mazeSource = await fs.readFile(
  path.join(root, "src", "games", "escape-maze", "useEscapeMaze.ts"),
  "utf8",
);

const palette = {
  background: "#0e1718",
  panel: "#172628",
  panelSoft: "#203436",
  cream: "#fff4d5",
  muted: "#b9c9c3",
  teal: "#42b7aa",
  blue: "#58a6d8",
  gold: "#e5b94f",
  coral: "#d77d66",
  green: "#7fb66b",
  wall: "#55615f",
  tile: "#263b3c",
  grid: "#4b6663",
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgFrame(width, height, body) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.38"/>
        </filter>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#142224"/>
          <stop offset="1" stop-color="#091112"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      ${body}
    </svg>`;
}

async function writeSvgPng(name, svg, width) {
  await sharp(Buffer.from(svg)).resize({ width }).png().toFile(path.join(evidenceDir, name));
}

function parseConstArray(name) {
  const marker = `const ${name}`;
  const markerIndex = mazeSource.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing ${name} in useEscapeMaze.ts`);
  const equalsIndex = mazeSource.indexOf("=", markerIndex);
  const start = mazeSource.indexOf("[", equalsIndex);
  let depth = 0;
  let inString = false;
  let quote = "";
  for (let index = start; index < mazeSource.length; index += 1) {
    const char = mazeSource[index];
    const previous = mazeSource[index - 1];
    if (inString) {
      if (char === quote && previous !== "\\") inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        const arraySource = mazeSource
          .slice(start, index + 1)
          .replace(/,(\s*[\]}])/g, "$1");
        return JSON.parse(arraySource);
      }
    }
  }
  throw new Error(`Unclosed array for ${name}`);
}

function parseCell(cell) {
  const [row, col] = cell.split(",").map(Number);
  return { row, col };
}

function mapBoard(route) {
  const width = 1400;
  const height = 980;
  const boardSize = 720;
  const cellSize = boardSize / 9;
  const boardX = 90;
  const boardY = 150;
  const state = route.initialState;
  const sets = {
    walls: new Set(state.walls),
    lights: new Set(state.lights),
    traps: new Set(state.traps),
  };
  const pieces = [];

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const key = `${row},${col}`;
      const x = boardX + col * cellSize;
      const y = boardY + row * cellSize;
      const isWall = sets.walls.has(key);
      pieces.push(
        `<rect x="${x + 3}" y="${y + 3}" width="${cellSize - 6}" height="${cellSize - 6}" rx="10" fill="${isWall ? palette.wall : palette.tile}" stroke="${isWall ? "#83908b" : palette.grid}" stroke-width="2"/>`,
      );
      if (isWall) {
        pieces.push(`<path d="M${x + 18} ${y + 25}h${cellSize - 36}M${x + 18} ${y + 52}h${cellSize - 36}" stroke="#a6afa9" stroke-width="4" opacity="0.42"/>`);
      }
      if (sets.traps.has(key)) {
        pieces.push(`<path d="M${x + cellSize / 2} ${y + 17}L${x + cellSize - 18} ${y + cellSize - 17}H${x + 18}Z" fill="${palette.coral}" stroke="#ffd7ca" stroke-width="2"/>`);
      }
      if (sets.lights.has(key)) {
        pieces.push(`<circle cx="${x + cellSize / 2}" cy="${y + cellSize / 2}" r="15" fill="${palette.gold}" stroke="#fff1a7" stroke-width="5"/>`);
      }
    }
  }

  const marker = (position, label, fill, radius = 24) => {
    const x = boardX + (position.col + 0.5) * cellSize;
    const y = boardY + (position.row + 0.5) * cellSize;
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${palette.cream}" stroke-width="4"/><text x="${x}" y="${y + 8}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#071112">${label}</text>`;
  };

  pieces.push(marker(state.player, "E", palette.blue));
  pieces.push(marker(state.guardian, "G", palette.coral));
  pieces.push(marker(state.exit, "P", palette.green, 27));
  if (state.chest) pieces.push(marker(parseCell(state.chest), "B", palette.teal, 20));

  const metricRows = [
    ["Rota", route.route],
    ["Modo", route.mode],
    ["Movimentos-base", route.baselineObjectiveMoves],
    ["Movimentos reais", route.actualMoves],
    ["Desvio", `+${route.deviationMoves}`],
    ["Menor distância do Guardião", route.minGuardianDistance],
    ["Turnos sob pressão", route.guardianPressureTurns],
    ["Resultado", "Concluída"],
  ];
  const metrics = metricRows
    .map(([label, value], index) => `<text x="910" y="${260 + index * 62}" font-family="Arial" font-size="24" fill="${palette.muted}">${escapeXml(label)}</text><text x="1280" y="${260 + index * 62}" text-anchor="end" font-family="Arial" font-size="28" font-weight="700" fill="${palette.cream}">${escapeXml(value)}</text>`)
    .join("");

  const body = `
    <text x="70" y="72" font-family="Georgia" font-size="48" font-weight="700" fill="${palette.cream}">Rota ${route.route} — validação jogável 9×9</text>
    <text x="70" y="115" font-family="Arial" font-size="24" fill="${palette.muted}">Estado inicial real capturado antes da conclusão manual</text>
    <rect x="55" y="130" width="790" height="790" rx="32" fill="#101b1c" stroke="#9b7b37" stroke-width="4" filter="url(#shadow)"/>
    ${pieces.join("")}
    <rect x="870" y="160" width="470" height="600" rx="28" fill="${palette.panel}" stroke="#5c7f79" stroke-width="3" filter="url(#shadow)"/>
    <text x="910" y="220" font-family="Georgia" font-size="34" font-weight="700" fill="${palette.cream}">Medições</text>
    ${metrics}
    <rect x="870" y="790" width="470" height="130" rx="24" fill="${palette.panelSoft}"/>
    <text x="905" y="830" font-family="Arial" font-size="20" font-weight="700" fill="${palette.cream}">Legenda</text>
    <text x="905" y="868" font-family="Arial" font-size="18" fill="${palette.muted}">E Explorador   G Guardião   P Portal   S Escudo</text>
    <text x="905" y="900" font-family="Arial" font-size="18" fill="${palette.muted}">Dourado luz   Coral obstáculo   Cinza bloqueio</text>`;
  return svgFrame(width, height, body);
}

function metricChart({ title, subtitle, metric, valueLabel, maxValue, colors }) {
  const width = 1400;
  const height = 820;
  const chartX = 170;
  const chartY = 180;
  const rowHeight = 72;
  const barWidth = 900;
  const rows = [];
  let rowIndex = 0;
  for (const stage of ["1", "2", "3"]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      const value = report.summary[stage][difficulty].metrics[metric].mean;
      const label = `Rota ${stage} · ${difficulty === "easy" ? "Aberto" : difficulty === "medium" ? "Equilibrado" : "Desafiador"}`;
      const y = chartY + rowIndex * rowHeight;
      const renderedWidth = Math.max(6, (value / maxValue) * barWidth);
      rows.push(`<text x="${chartX}" y="${y + 27}" font-family="Arial" font-size="22" fill="${palette.cream}">${label}</text>`);
      rows.push(`<rect x="${chartX + 250}" y="${y}" width="${barWidth}" height="36" rx="18" fill="#263638"/>`);
      rows.push(`<rect x="${chartX + 250}" y="${y}" width="${renderedWidth}" height="36" rx="18" fill="${colors[Number(stage) - 1]}"/>`);
      rows.push(`<text x="${chartX + 250 + renderedWidth + 14}" y="${y + 27}" font-family="Arial" font-size="22" font-weight="700" fill="${palette.cream}">${valueLabel(value)}</text>`);
      rowIndex += 1;
    }
  }
  return svgFrame(width, height, `
    <text x="70" y="78" font-family="Georgia" font-size="46" font-weight="700" fill="${palette.cream}">${escapeXml(title)}</text>
    <text x="70" y="122" font-family="Arial" font-size="23" fill="${palette.muted}">${escapeXml(subtitle)}</text>
    <rect x="55" y="145" width="1290" height="620" rx="30" fill="${palette.panel}" stroke="#47635f" stroke-width="3"/>
    ${rows.join("")}
  `);
}

function templateComparison() {
  const core = parseConstArray("MAZE_TEMPLATES");
  const stageOne = parseConstArray("STAGE_ONE_TEMPLATES");
  const templates = [stageOne[0], ...core];
  const labels = ["Rota 1 · abertura", "Base A", "Base B", "Base C"];
  const width = 1500;
  const height = 760;
  const panelWidth = 330;
  const cell = 29;
  const bodies = templates.map((template, templateIndex) => {
    const x = 55 + templateIndex * 360;
    const y = 180;
    const cells = template.flatMap((row, rowIndex) => row.map((wall, colIndex) => `<rect x="${x + 34 + colIndex * cell}" y="${y + 80 + rowIndex * cell}" width="${cell - 3}" height="${cell - 3}" rx="4" fill="${wall ? palette.wall : palette.tile}" stroke="${wall ? "#9aa39d" : palette.grid}"/>`)).join("");
    const stages = templateIndex === 0 ? "Usada pela Rota 1" : templateIndex === 1 ? "Rotas 2" : "Rotas 2 e 3";
    return `
      <rect x="${x}" y="${y}" width="${panelWidth}" height="450" rx="26" fill="${palette.panel}" stroke="#5b756f" stroke-width="3"/>
      <text x="${x + panelWidth / 2}" y="${y + 45}" text-anchor="middle" font-family="Georgia" font-size="26" font-weight="700" fill="${palette.cream}">${labels[templateIndex]}</text>
      ${cells}
      <text x="${x + panelWidth / 2}" y="${y + 380}" text-anchor="middle" font-family="Arial" font-size="19" fill="${palette.muted}">${stages}</text>
      <text x="${x + panelWidth / 2}" y="${y + 415}" text-anchor="middle" font-family="Arial" font-size="18" fill="${palette.gold}">9×9 · ${template.flat().filter(Boolean).length} bloqueios-base</text>`;
  }).join("");
  return svgFrame(width, height, `
    <text x="70" y="72" font-family="Georgia" font-size="46" font-weight="700" fill="${palette.cream}">Variedade estrutural dos quatro templates</text>
    <text x="70" y="118" font-family="Arial" font-size="23" fill="${palette.muted}">Cobertura forçada: 360 execuções; os quatro padrões foram validados sem fallback.</text>
    ${bodies}
  `);
}

function beforeAfter() {
  const width = 1400;
  const height = 760;
  const grid = (size, x, y, area, color) => {
    const cell = area / size;
    const cells = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        cells.push(`<rect x="${x + col * cell + 2}" y="${y + row * cell + 2}" width="${cell - 4}" height="${cell - 4}" rx="6" fill="${palette.tile}" stroke="${color}" stroke-width="2"/>`);
      }
    }
    return cells.join("");
  };
  return svgFrame(width, height, `
    <text x="70" y="72" font-family="Georgia" font-size="46" font-weight="700" fill="${palette.cream}">Fundação da Rota: 7×7 → 9×9</text>
    <text x="70" y="118" font-family="Arial" font-size="23" fill="${palette.muted}">Comparação estrutural; nenhuma regra de movimento foi alterada.</text>
    <rect x="70" y="160" width="570" height="520" rx="32" fill="${palette.panel}" stroke="#536b67" stroke-width="3"/>
    <rect x="760" y="160" width="570" height="520" rx="32" fill="${palette.panel}" stroke="${palette.teal}" stroke-width="4"/>
    <text x="355" y="215" text-anchor="middle" font-family="Georgia" font-size="32" fill="${palette.cream}">Antes · 7×7</text>
    <text x="1045" y="215" text-anchor="middle" font-family="Georgia" font-size="32" fill="${palette.cream}">Fundação atual · 9×9</text>
    ${grid(7, 175, 250, 360, palette.grid)}
    ${grid(9, 865, 250, 360, palette.teal)}
    <text x="355" y="645" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="${palette.muted}">49 células</text>
    <text x="1045" y="645" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="${palette.cream}">81 células · +65%</text>
  `);
}

await writeSvgPng("route-1-map.png", mapBoard(live.routes[0]), 1400);
await writeSvgPng("route-2-map.png", mapBoard(live.routes[1]), 1400);
await writeSvgPng(
  "route-9x9-reachability.png",
  metricChart({
    title: "Alcance navegável nos 2.160 mapas",
    subtitle: "Média de células alcançáveis por rota e modo; mínimo aceito cresce com o espaço 9×9.",
    metric: "reachableCells",
    valueLabel: (value) => `${value.toFixed(1)} / 81`,
    maxValue: 81,
    colors: [palette.green, palette.blue, palette.gold],
  }),
  1400,
);
await writeSvgPng(
  "route-9x9-guardian-distance.png",
  metricChart({
    title: "Distância inicial do Guardião",
    subtitle: "Média Manhattan ao nascer; nenhuma configuração aproximou o Guardião de forma injusta.",
    metric: "guardianDistance",
    valueLabel: (value) => value.toFixed(1),
    maxValue: 18,
    colors: [palette.green, palette.blue, palette.gold],
  }),
  1400,
);
await writeSvgPng("route-9x9-template-comparison.png", templateComparison(), 1500);
await writeSvgPng("route-9x9-before-after.png", beforeAfter(), 1400);

console.log("Rendered ROTA-9X9-VALIDATION-01 evidence.");
