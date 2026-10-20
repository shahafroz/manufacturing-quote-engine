// Turn slices into a print-time and filament estimate, and the part geometry into a CNC
// machining estimate. All settings are in one place so they can be matched to PrusaSlicer.

// Defaults match PrusaSlicer's default printer profile (read from its G-code), so the
// comparison in the README is like for like. Change them to match any other printer.
export const PRINT_SETTINGS = {
  layerHeight: 0.2, // mm
  lineWidth: 0.45, // mm, extrusion width
  walls: 2, // perimeters
  infill: 0.2, // 20 %
  topBottomLayers: 4, // solid layers at top and bottom surfaces
  perimeterSpeed: 60, // mm/s, inner walls
  externalPerimeterSpeed: 30, // mm/s, outer wall (50 % of perimeter speed)
  smallPerimeterSpeed: 15, // mm/s, loops shorter than smallPerimeterLength
  smallPerimeterLength: 40, // mm (≈ a 6.5 mm radius circle)
  infillSpeed: 80, // mm/s
  solidSpeed: 20, // mm/s, bottom / internal solid layers
  topSolidSpeed: 15, // mm/s, top skins
  firstLayerSpeed: 30, // mm/s, everything on layer 1
  travelSpeed: 130, // mm/s
  acceleration: 1500, // mm/s², limits speed on short moves
  retractTime: 0.1, // s per travel (2 mm out and back in at 40 mm/s)
  minLayerTime: 5, // s, cooling slows down tiny layers…
  minPrintSpeed: 10, // mm/s …but never below this speed
  cornerAngle: 30, // degrees: the printer keeps its speed through gentler bends than this
  supportDensity: 0.15, // support material is printed 15 % dense
  supportSpeed: 60, // mm/s
};

// Time to move `len` mm with top speed v and acceleration a, starting and ending at rest.
// Long moves cruise at v; short moves never reach v (triangle speed profile).
export function moveTime(len, v, a) {
  if (len <= 0) return 0;
  const ramp = (v * v) / a; // distance spent speeding up + slowing down
  return len >= ramp ? len / v + v / a : 2 * Math.sqrt(len / a);
}

const fillLength = (area, spacing) => (area > 0 ? area / spacing : 0);

// Split a closed loop into runs separated by corners sharper than `cornerDeg`.
export function smoothRuns(loop, cornerDeg) {
  const m = loop.length / 2;
  const cosLimit = Math.cos((cornerDeg * Math.PI) / 180);
  const runs = [];
  let length = 0, run = 0, px = 0, py = 0, havePrev = false;
  for (let k = 0; k < m; k++) {
    const j = (k + 1) % m;
    const dx = loop[j * 2] - loop[k * 2], dy = loop[j * 2 + 1] - loop[k * 2 + 1];
    const d = Math.hypot(dx, dy);
    if (d === 0) continue;
    const ux = dx / d, uy = dy / d;
    if (havePrev && ux * px + uy * py < cosLimit) {
      runs.push(run); // sharp corner: end this run
      run = 0;
    }
    run += d;
    length += d;
    px = ux; py = uy; havePrev = true;
  }
  if (run > 0) runs.push(run);
  return { runs, length };
}

export function estimatePrint(sliced, supportVolume = 0, settings = {}) {
  const s = { ...PRINT_SETTINGS, ...settings };
  const a = s.acceleration;
  const { layers } = sliced;
  const n = layers.length;
  let perimeterLen = 0, infillLen = 0, solidLen = 0, travelLen = 0, timeS = 0;

  for (let i = 0; i < n; i++) {
    const L = layers[i];
    const first = i === 0;
    const area = Math.max(0, L.area);
    let t = 0;

    // walls: split each loop into smooth runs at sharp corners. The printer keeps its speed
    // through gentle bends (curved surfaces are made of many tiny segments) and only has to
    // slow down at real corners, so each run costs one acceleration + one deceleration.
    for (const loop of L.loops) {
      const { runs, length } = smoothRuns(loop, s.cornerAngle);
      const small = length < s.smallPerimeterLength;
      for (let w = 0; w < s.walls; w++) {
        const v = first ? s.firstLayerSpeed : small ? s.smallPerimeterSpeed : w === 0 ? s.externalPerimeterSpeed : s.perimeterSpeed;
        for (const r of runs) t += moveTime(r, v, a);
      }
      perimeterLen += length * s.walls;
      t += moveTime(10, s.travelSpeed, a) + s.retractTime; // move to the loop
      travelLen += 10;
    }

    // inside the walls: split into solid skin (top / bottom) and sparse infill
    const inner = Math.max(0, area - L.perimeter * s.walls * s.lineWidth);
    let top = 0, bottom = 0;
    for (let k = 1; k <= s.topBottomLayers; k++) {
      const above = i + k < n ? Math.max(0, layers[i + k].area) : 0;
      const below = i - k >= 0 ? Math.max(0, layers[i - k].area) : 0;
      top = Math.max(top, area - above);
      bottom = Math.max(bottom, area - below);
    }
    top = Math.min(inner, Math.max(0, top));
    bottom = Math.min(inner - top, Math.max(0, bottom));
    const sparse = inner - top - bottom;

    // fill lines run across the region; their typical length is about √area
    const lineLen = Math.max(1, Math.sqrt(area));
    const fill = (region, spacing, v) => {
      const len = fillLength(region, spacing);
      const lines = len / lineLen;
      t += lines * moveTime(lineLen, first ? s.firstLayerSpeed : v, a);
      return len;
    };
    const topLen = fill(top, s.lineWidth, s.topSolidSpeed);
    const bottomLen = fill(bottom, s.lineWidth, s.solidSpeed);
    solidLen += topLen + bottomLen;
    infillLen += fill(sparse, s.lineWidth / s.infill, s.infillSpeed);

    t += moveTime(Math.sqrt(area) * 2, s.travelSpeed, a) + s.retractTime; // between regions
    travelLen += Math.sqrt(area) * 2;
    // cooling: tiny layers are slowed down to give the plastic time to cool, but the printer
    // won't go below minPrintSpeed (we assume ~3× slower is the most it can stretch)
    if (t < s.minLayerTime) t = Math.min(s.minLayerTime, t * (30 / s.minPrintSpeed));
    timeS += t;
  }

  const supportLen = (supportVolume * s.supportDensity) / (s.lineWidth * s.layerHeight);
  timeS += supportLen / s.supportSpeed;
  const extrudedLen = perimeterLen + infillLen + solidLen + supportLen;

  return {
    layers: n,
    timeS,
    extrudedVolume: extrudedLen * s.lineWidth * s.layerHeight, // mm³ of plastic
    paths: { perimeterLen, infillLen, solidLen, supportLen, travelLen },
    settings: s,
  };
}

// CNC: start from a block (bounding box + margin), cut away everything that isn't the part.
export const CNC_MATERIALS = {
  aluminum_6061: { removalRate: 8000, finishRate: 3000 }, // mm³/min roughing, mm²/min finishing
  steel_1018: { removalRate: 2000, finishRate: 1000 },
};

export function estimateCnc(geometry, p, margin = 3) {
  const [sx, sy, sz] = geometry.bbox.size;
  const stock = [sx + 2 * margin, sy + 2 * margin, sz + 2 * margin];
  const stockVolume = stock[0] * stock[1] * stock[2];
  const removalVolume = Math.max(0, stockVolume - geometry.volume);

  // A setup is needed for every side the cutter must reach: count the axis directions that a
  // meaningful share (>1 %) of the surface faces toward.
  const facing = [0, 0, 0, 0, 0, 0]; // +x −x +y −y +z −z
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
    const len = Math.hypot(...n);
    if (!len) continue;
    for (let d = 0; d < 3; d++) {
      const c = n[d] / len;
      if (c > 0.5) facing[d * 2] += len / 2;
      if (c < -0.5) facing[d * 2 + 1] += len / 2;
    }
  }
  const setups = Math.max(1, facing.filter((a) => a > geometry.surfaceArea * 0.01).length);

  const perMaterial = {};
  for (const [name, m] of Object.entries(CNC_MATERIALS)) {
    const minutes = removalVolume / m.removalRate + geometry.surfaceArea / m.finishRate;
    perMaterial[name] = { machiningMin: minutes };
  }
  return { stock, stockVolume, removalVolume, setups, perMaterial };
}
