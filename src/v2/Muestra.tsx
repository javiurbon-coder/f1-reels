// Muestrario de diseño: una composición con todos los tipos de reel (los datos son DE EJEMPLO, no reales).
import React from 'react';
import {Dato, Fuentes, Mercado, Noticia, Portada, Resultado, Rumor, Tecnico} from './types';

export type MuestraProps = {kind: string};
export const Muestra: React.FC<MuestraProps> = ({kind}) => {
  switch (kind) {
    case 'portada': return <Portada headline="Alonso renueva con Aston Martin hasta 2028" hl="ALONSO" chip="3 fuentes" date="10 NOV" />;
    case 'noticia': return <Noticia cap="El acuerdo incluye dos años más de contrato" on="contrato" rows={[
      {icon: 'doc', title: 'Renueva dos años', sub: 'Contrato hasta final de 2028'},
      {icon: 'calendar', title: 'Anuncio oficial hoy', sub: 'Comunicado del equipo'},
      {icon: 'wrench', title: 'Nuevo motor en 2026', sub: 'Cambio de reglamento'},
      {icon: 'trophy', title: 'Objetivo: el podio', sub: 'Lo dice el propio piloto'}]} />;
    case 'dato': return <Dato cap="Salió séptimo y acabó ganando la carrera" on="ganando" value="+6" label="posiciones ganadas en carrera" rows={[
      {name: 'Verstappen', grid: 7, finish: 1, color: '#3671c6', me: true}, {name: 'Norris', grid: 1, finish: 2, color: '#ff8000'},
      {name: 'Piastri', grid: 3, finish: 3, color: '#ff8000'}, {name: 'Alonso', grid: 10, finish: 6, color: '#229971'}, {name: 'Leclerc', grid: 4, finish: 8, color: '#e8002d'}]} />;
    case 'resultado': return <Resultado cap="Así queda el podio del gran premio" on="podio" gp="GP de Brasil · Interlagos" fastest="Verstappen 1:12.345" podium={[
      {name: 'Verstappen', team: 'Red Bull', color: '#3671c6', gap: '1:32:01'}, {name: 'Norris', team: 'McLaren', color: '#ff8000', gap: '+4.2 s'}, {name: 'Piastri', team: 'McLaren', color: '#ff8000', gap: '+9.8 s'}]} />;
    case 'mercado': return <Mercado cap="Alonso seguirá de verde dos temporadas más" on="verde" kindLabel="RENOVACIÓN" driver="Alonso" team="Aston Martin" teamColor="#2fb38a" until="2028" />;
    case 'rumor': return <Rumor cap="Ojo: esto todavía no está confirmado" on="confirmado" who="PlanetF1 · sin confirmación oficial" n={1} />;
    case 'tecnico': return <Tecnico cap="El suelo pega el coche al asfalto" on="suelo" title="El efecto suelo" parts={[
      {n: 1, name: 'Alerón delantero', sub: 'Ordena el aire que llega al coche'}, {n: 2, name: 'Suelo', sub: 'Aire rápido debajo = baja presión'}, {n: 3, name: 'Alerón trasero', sub: 'Empuja el eje trasero hacia abajo'}]} />;
    default: return <Fuentes cap="Lo cuentan tres medios distintos" on="tres" sources={[
      {name: 'Formula1.com', domain: 'formula1.com', official: true}, {name: 'Motorsport.com', domain: 'es.motorsport.com'}, {name: 'Diario AS', domain: 'as.com'}]} />;
  }
};
