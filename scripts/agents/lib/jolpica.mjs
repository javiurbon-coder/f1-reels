// Datos REALES de F1 (API pública Jolpica, compatible con Ergast). Sin clave, gratis.
// En pruebas (JOLPICA_FIXTURES=data/fixtures) lee archivos locales en vez de internet.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://api.jolpi.ca/ergast/f1';
const cache = new Map();

export const COLORS = {
  mclaren: '#ff8000', red_bull: '#3671c6', ferrari: '#e8002d', mercedes: '#27f4d2',
  aston_martin: '#229971', alpine: '#ff87bc', williams: '#64c4ff', rb: '#6692ff', racing_bulls: '#6692ff',
  haas: '#b6babd', sauber: '#52e252', audi: '#c8c8c8', cadillac: '#9aa0a6',
};

async function jget(file, url) {
  if (process.env.JOLPICA_FIXTURES) return JSON.parse(fs.readFileSync(path.join(process.env.JOLPICA_FIXTURES, file), 'utf8')).MRData;
  if (cache.has(url)) return cache.get(url);
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + url, {signal: AbortSignal.timeout(15000), headers: {'user-agent': 'contrastado-f1/1.0'}});
      if (!r.ok) throw new Error(`Jolpica ${r.status}`);
      const j = (await r.json()).MRData;
      cache.set(url, j);
      return j;
    } catch (e) { err = e; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); }
  }
  throw err;
}

export const lastRace = async () => (await jget('last.json', '/current/last/results.json')).RaceTable.Races[0];
export const lap1 = async (season, round) => (await jget('lap1.json', `/${season}/${round}/laps/1.json`)).RaceTable.Races[0]?.Laps?.[0]?.Timings ?? [];
export const driverSeason = async (driverId) => (await jget(`driver-${driverId}.json`, `/current/drivers/${driverId}/results.json?limit=100`)).RaceTable.Races;
export const standings = async () => (await jget('standings.json', '/current/driverStandings.json')).StandingsTable.StandingsLists[0]?.DriverStandings ?? [];

/** Historial de un piloto en un circuito concreto (todas las temporadas): para buscar precedentes. */
export const driverAtCircuit = async (driverId, circuitId) => (await jget(`circuit-${driverId}.json`, `/drivers/${driverId}/circuits/${circuitId}/results.json?limit=100`)).RaceTable.Races;
