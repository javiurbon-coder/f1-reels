// Previa del próximo GP → cola de revisión (serie "Esta semana"). Fuente: API pública Jolpica.
// Uso: node scripts/fetch-calendar.mjs
import {enqueue} from './lib/queue.mjs';

const TZ = 'Europe/Madrid';
const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SESSIONS = [['FirstPractice', 'Libres 1'], ['SecondPractice', 'Libres 2'], ['ThirdPractice', 'Libres 3'], ['SprintQualifying', 'Clasif. sprint'], ['Sprint', 'Sprint'], ['Qualifying', 'Clasificación']];

const PAIS = {Australia: 'Australia', China: 'China', Japan: 'Japón', Bahrain: 'Baréin', 'Saudi Arabia': 'Arabia Saudí', USA: 'EE. UU.', 'United States': 'EE. UU.', Italy: 'Italia', Monaco: 'Mónaco', Spain: 'España', Canada: 'Canadá', Austria: 'Austria', UK: 'Gran Bretaña', 'United Kingdom': 'Gran Bretaña', Belgium: 'Bélgica', Hungary: 'Hungría', Netherlands: 'Países Bajos', Azerbaijan: 'Azerbaiyán', Singapore: 'Singapur', Mexico: 'México', Brazil: 'Brasil', Qatar: 'Catar', UAE: 'Abu Dabi', 'United Arab Emirates': 'Abu Dabi'};
const local = (date, time) => {
  const d = new Date(`${date}T${time ?? '00:00:00Z'}`);
  const parts = new Intl.DateTimeFormat('es-ES', {timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {d, day: get('weekday').replace('.', '').replace(/^./, (c) => c.toUpperCase()), time: `${get('hour')}:${get('minute')}`};
};

export function buildWeek(race) {
  const list = SESSIONS.filter(([k]) => race[k]).map(([k, name]) => ({...local(race[k].date, race[k].time), name}));
  list.push({...local(race.date, race.time), name: 'Carrera'});
  list.sort((a, b) => a.d - b.d);
  const first = list[0].d, last = list.at(-1).d;
  const mon = (d) => d.toLocaleDateString('es-ES', {timeZone: TZ, month: 'short'}).replace('.', '').toUpperCase();
  const dn = (d) => Number(d.toLocaleDateString('es-ES', {timeZone: TZ, day: 'numeric'}));
  return {
    id: `semana-${race.season}-${race.round}`,
    props: {
      gp: 'GP de ' + (PAIS[race.Circuit.Location?.country] ?? race.Circuit.Location?.country ?? race.raceName.replace(' Grand Prix', '')),
      circuit: race.Circuit.circuitName,
      dates: `${dn(first)}-${dn(last)} ${mon(last)}`,
      sessions: list.slice(0, 6).map(({day, name, time}) => ({day, name, time})),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fetch-calendar.mjs')) {
  const res = await fetch('https://api.jolpi.ca/ergast/f1/current/next.json');
  if (!res.ok) throw new Error(`Jolpica respondió ${res.status}`);
  const race = (await res.json()).MRData.RaceTable.Races[0];
  if (!race) throw new Error('No hay próximo GP en la respuesta');
  const {id, props} = buildWeek(race);
  const r = await enqueue({id, composition: 'EstaSemana', props, caption: `${props.gp} · ${props.dates}\n\nHorarios en hora de España (Madrid).\n\n#F1 #GranPremio`, note: 'Comprueba horarios con la web oficial antes de aprobar.'});
  console.log(r.skipped ? 'Ya estaba en cola.' : `✓ en cola: ${props.gp}`);
}
