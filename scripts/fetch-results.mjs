// Descarga el último GP (API pública Jolpica/Ergast) y lo convierte al formato de ResultsReel.
// Uso: node scripts/fetch-results.mjs data/results.json [@tu_cuenta]
import fs from 'node:fs';

const [out = 'data/results.json'] = process.argv.slice(2);

// Colores de equipo aproximados; añade/ajusta los de la temporada en curso.
const COLORS = {
  mclaren: '#ff8000', red_bull: '#3671c6', ferrari: '#e8002d', mercedes: '#27f4d2',
  aston_martin: '#229971', alpine: '#ff87bc', williams: '#64c4ff', rb: '#6692ff',
  haas: '#b6babd', sauber: '#52e252', audi: '#c8c8c8', cadillac: '#9aa0a6',
};

const res = await fetch('https://api.jolpi.ca/ergast/f1/current/last/results.json');
if (!res.ok) throw new Error(`Jolpica respondió ${res.status}`);
const race = (await res.json()).MRData.RaceTable.Races[0];
if (!race) throw new Error('Sin carreras en la respuesta');

const rows = race.Results.slice(0, 10).map((r) => ({
  pos: Number(r.position),
  driver: r.Driver.familyName,
  team: r.Constructor.name,
  color: COLORS[r.Constructor.constructorId] ?? '#888888',
  time: r.position === '1' ? (r.Time?.time ?? r.status) : (r.Time?.time ? `+${r.Time.time}` : r.status),
}));

const fl = race.Results.find((r) => r.FastestLap?.rank === '1');
const props = {
  race: race.raceName.replace('Grand Prix', 'GP'),
  circuit: race.Circuit.circuitName,
  date: new Date(race.date).toLocaleDateString('es-ES', {day: '2-digit', month: 'short', year: 'numeric'}),
  podium: rows.slice(0, 3),
  rest: rows.slice(3, 10),
  ...(fl && {fastestLap: {driver: fl.Driver.familyName, time: fl.FastestLap.Time.time}}),
};
fs.writeFileSync(out, JSON.stringify(props, null, 2));
console.log('OK →', out, `(${props.race})`);
