// AGENTE ANALISTA (sin IA, determinista): convierte datos reales de Jolpica en hallazgos con cifras CALCULADAS.
// Cada hallazgo = {id, line (frase en español), keys (palabras/cifras para encajarlo con el guion), scene (gráfica)}.
import {lastRace, lap1, driverSeason, standings, driverAtCircuit, COLORS} from './jolpica.mjs';

const ord = (n) => `${n}º`;
const FINISHED = /^(Finished|\+\d+ Laps?|Lapped)$/;
export const isDnf = (status) => !FINISHED.test(status ?? 'Finished');
const num = (x) => (x === undefined || x === null || x === '' ? NaN : Number(x));
const CODES = {bahrain: 'BHR', 'saudi arabian': 'SAU', australian: 'AUS', japanese: 'JPN', chinese: 'CHN', miami: 'MIA', 'emilia romagna': 'IMO', monaco: 'MON', canadian: 'CAN', spanish: 'ESP', austrian: 'AUT', british: 'GBR', hungarian: 'HUN', belgian: 'BEL', dutch: 'NED', italian: 'ITA', azerbaijan: 'AZE', singapore: 'SIN', 'united states': 'USA', 'mexico city': 'MEX', 'mexican': 'MEX', 'sao paulo': 'BRA', 'são paulo': 'BRA', brazilian: 'BRA', 'las vegas': 'LVG', qatar: 'QAT', 'abu dhabi': 'ABU', madrid: 'MAD'};
const abbr = (raceName) => {
  const n = (raceName ?? '').replace(/\s*Grand Prix/i, '').trim();
  return CODES[n.toLowerCase()] ?? n.slice(0, 3).toUpperCase();
};

/** Hallazgos de UNA carrera para un piloto. */
export function raceFacts(race, laps1, driverId) {
  const out = [];
  const rows = race.Results.map((r) => ({
    id: r.Driver.driverId, name: r.Driver.familyName, team: r.Constructor.constructorId,
    grid: num(r.grid) > 0 ? num(r.grid) : null, finish: num(r.position), status: r.status,
  }));
  const me = rows.find((r) => r.id === driverId);
  if (!me) return out;
  const gp = race.raceName.replace(/ Grand Prix/i, ' GP');

  if (me.grid && !isDnf(me.status)) {
    const gain = me.grid - me.finish;
    const verb = gain > 0 ? `ganó ${gain} ${gain === 1 ? 'posición' : 'posiciones'}` : gain < 0 ? `perdió ${-gain} ${gain === -1 ? 'posición' : 'posiciones'}` : 'mantuvo su posición';
    const others = rows.filter((r) => r.id !== me.id && r.grid && !isDnf(r.status)).sort((a, b) => (b.grid - b.finish) - (a.grid - a.finish)).slice(0, 4);
    const pick = [me, ...others].sort((a, b) => a.finish - b.finish);
    out.push({
      id: 'grid-finish', weight: Math.abs(gain) + 3,
      line: `En el ${gp}, ${me.name} salió ${ord(me.grid)} y terminó ${ord(me.finish)}: ${verb}.`,
      keys: [me.name, String(me.grid), String(me.finish)],
      scene: {type: 'bars', title: `${me.name}: de ${ord(me.grid)} a ${ord(me.finish)}`, hl: me.name,
        rows: pick.map((r) => ({name: r.name, grid: r.grid, finish: r.finish, color: COLORS[r.team] ?? '#888888', me: r.id === me.id}))},
    });
  }
  const l1 = laps1.find((t) => t.driverId === driverId);
  if (l1 && me.grid) {
    const d = me.grid - num(l1.position);
    if (Math.abs(d) >= 2) {
      out.push({
        id: 'lap1', weight: Math.abs(d) + 4,
        line: `En la primera vuelta ${me.name} pasó del ${ord(me.grid)} al ${ord(num(l1.position))}.`,
        keys: [me.name, 'primera vuelta', String(me.grid), String(num(l1.position))],
        scene: {type: 'stat', value: d, label: d > 0 ? 'posiciones ganadas en la vuelta 1' : 'posiciones perdidas en la vuelta 1', title: `Vuelta 1: del ${ord(me.grid)} al ${ord(num(l1.position))}`},
      });
    }
  }
  return out;
}

/** Hallazgos de la racha de resultados de un piloto en la temporada. */
export function driverFacts(races, name) {
  const out = [];
  const res = races.map((r) => ({label: abbr(r.raceName), pos: num(r.Results[0].position), dnf: isDnf(r.Results[0].status)}));
  if (res.length < 3) return out;
  const last = res.slice(-6);
  const podiums = last.filter((r) => !r.dnf && r.pos <= 3).length;
  let streak = 0;
  for (let i = res.length - 1; i >= 0 && !res[i].dnf && res[i].pos <= 3; i--) streak++;
  const line = streak >= 2 ? `${name} lleva ${streak} podios seguidos.` : `${name} suma ${podiums} ${podiums === 1 ? 'podio' : 'podios'} en sus últimas ${last.length} carreras.`;
  out.push({
    id: 'streak', weight: streak >= 2 ? streak + 3 : podiums + 1, line,
    keys: [name, String(streak >= 2 ? streak : podiums), 'podio'],
    scene: {type: 'streak', title: `Sus últimas ${last.length} carreras`, items: last},
  });
  return out;
}

/** PRECEDENTES: qué hizo ese piloto en ESTE MISMO circuito otros años (victorias y mayor remontada). */
export function circuitFacts(races, name, season, circuitName) {
  const out = [];
  const past = races.filter((r) => String(r.season) !== String(season)).map((r) => {
    const x = r.Results[0];
    return {year: String(r.season), grid: num(x.grid) > 0 ? num(x.grid) : null, finish: num(x.position), dnf: isDnf(x.status), team: x.Constructor?.constructorId};
  });
  if (!past.length) return out;
  const wins = past.filter((r) => !r.dnf && r.finish === 1);
  const done = past.filter((r) => !r.dnf && r.grid);
  const best = [...done].sort((a, b) => (b.grid - b.finish) - (a.grid - a.finish))[0];
  const rows = done.slice(-5).map((r) => ({name: r.year, grid: r.grid, finish: r.finish, color: COLORS[r.team] ?? '#888888', me: best && r.year === best.year}));
  if (best && best.grid - best.finish >= 5) {
    out.push({
      id: 'precedent', weight: 8 + Math.min(6, best.grid - best.finish),
      line: `No es la primera vez: en ${best.year}, ${name} salió ${ord(best.grid)} y terminó ${ord(best.finish)} en este mismo circuito.`,
      keys: [name, best.year, String(best.grid), String(best.finish), 'primera vez'],
      scene: rows.length >= 2 ? {type: 'bars', title: `${name} en ${circuitName}`, hl: name, rows} : {type: 'stat', value: best.grid - best.finish, label: `posiciones ganadas aquí en ${best.year}`, title: `${name} en ${circuitName}`},
    });
  }
  if (wins.length) out.push({
    id: 'circuit-wins', weight: 4 + Math.min(4, wins.length),
    line: `${name} ya ha ganado ${wins.length} ${wins.length === 1 ? 'vez' : 'veces'} en este circuito (${wins.map((w) => w.year).join(', ')}).`,
    keys: [name, String(wins.length), 'ganado', ...wins.map((w) => w.year)],
    scene: {type: 'stat', value: wins.length, label: wins.length === 1 ? 'victoria en este circuito' : 'victorias en este circuito', title: `${name} en ${circuitName}`},
  });
  return out;
}

/** Hallazgos del campeonato. */
export function standingsFacts(table, driverId) {
  const out = [];
  if (!table.length) return out;
  const top = table.slice(0, 5);
  const me = table.find((s) => s.Driver.driverId === driverId);
  const rows = top.map((s) => ({name: s.Driver.familyName, value: num(s.points), color: COLORS[s.Constructors?.[0]?.constructorId] ?? '#888888', me: s.Driver.driverId === driverId}));
  if (me && !rows.some((r) => r.me)) rows[rows.length - 1] = {name: me.Driver.familyName, value: num(me.points), color: COLORS[me.Constructors?.[0]?.constructorId] ?? '#888888', me: true};
  const leader = num(table[0].points);
  if (me) {
    const gap = leader - num(me.points), pos = num(me.position);
    out.push({
      id: 'standings', weight: 3,
      line: pos === 1 ? `${me.Driver.familyName} lidera el campeonato con ${num(me.points)} puntos.` : `${me.Driver.familyName} es ${ord(pos)} del campeonato con ${num(me.points)} puntos, a ${gap} del líder.`,
      keys: [me.Driver.familyName, String(num(me.points)), 'campeonato'],
      scene: {type: 'rank', title: 'Así va el campeonato', unit: 'pts', rows},
    });
    if (num(me.wins) >= 1) out.push({
      id: 'wins', weight: 2 + Math.min(4, num(me.wins)),
      line: `${me.Driver.familyName} acumula ${num(me.wins)} ${num(me.wins) === 1 ? 'victoria' : 'victorias'} esta temporada.`,
      keys: [me.Driver.familyName, String(num(me.wins)), 'victoria'],
      scene: {type: 'stat', value: num(me.wins), label: num(me.wins) === 1 ? 'victoria esta temporada' : 'victorias esta temporada', title: `Victorias de ${me.Driver.familyName}`},
    });
  } else {
    out.push({id: 'standings', weight: 1, line: `Líder del campeonato: ${table[0].Driver.familyName} con ${leader} puntos.`, keys: [table[0].Driver.familyName, String(leader)],
      scene: {type: 'rank', title: 'Así va el campeonato', unit: 'pts', rows}});
  }
  return out;
}

/** Orquesta las consultas. Si algo falla devuelve [] (el reel sale igual, sin gráficas de datos). */
export async function analyze({driverId, driverName}) {
  const facts = [];
  const safe = async (f) => { try { return await f(); } catch (e) { console.log('  · datos no disponibles:', e.message); return null; } };
  if (!driverId) return facts;
  const race = await safe(lastRace);
  if (race) {
    const laps = (await safe(() => lap1(race.season, race.round))) ?? [];
    facts.push(...raceFacts(race, laps, driverId));
    if (race.Circuit?.circuitId) {
      const hist = await safe(() => driverAtCircuit(driverId, race.Circuit.circuitId));
      if (hist?.length) facts.push(...circuitFacts(hist, driverName, race.season, race.Circuit.circuitName));
    }
  }
  const races = await safe(() => driverSeason(driverId));
  if (races?.length) facts.push(...driverFacts(races, driverName));
  const table = await safe(standings);
  if (table) facts.push(...standingsFacts(table, driverId));
  return facts.sort((a, b) => b.weight - a.weight);
}
