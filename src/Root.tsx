import React from 'react';
import {Composition} from 'remotion';
import {ResultsReel, ResultsProps, RESULTS_TOTAL} from './ResultsReel';
import {DatoRapido, DatoProps, DATO_TOTAL} from './DatoRapido';
import {NoticiaVerificada, NoticiaProps, NOTICIA_TOTAL, noticiaDuration} from './NoticiaVerificada';
import {Mercado, MercadoProps, MERCADO_TOTAL, mercadoDuration} from './Mercado';
import {Rumor, RumorProps, RUMOR_TOTAL, rumorDuration} from './Rumor';
import {EstaSemana, SemanaProps, SEMANA_TOTAL, semanaDuration} from './EstaSemana';
import sampleMercado from '../data/sample-mercado.json';
import sampleRumor from '../data/sample-rumor.json';
import sampleSemana from '../data/sample-semana.json';
import {theme} from './theme';
import sampleResults from '../data/sample-results.json';
import sampleDato from '../data/sample-dato.json';
import sampleNoticia from '../data/sample-noticia.json';

const common = {width: theme.width, height: theme.height, fps: theme.fps};

export const Root: React.FC = () => (
  <>
    <Composition id="ResultsReel" component={ResultsReel} durationInFrames={RESULTS_TOTAL} defaultProps={sampleResults as ResultsProps} {...common} />
    <Composition id="DatoRapido" component={DatoRapido} durationInFrames={DATO_TOTAL} defaultProps={sampleDato as DatoProps} {...common} />
    <Composition id="NoticiaVerificada" component={NoticiaVerificada} durationInFrames={NOTICIA_TOTAL} defaultProps={sampleNoticia as NoticiaProps} calculateMetadata={({props}) => ({durationInFrames: noticiaDuration(props as NoticiaProps)})} {...common} />
    <Composition id="Mercado" component={Mercado} durationInFrames={MERCADO_TOTAL} defaultProps={sampleMercado as MercadoProps} calculateMetadata={({props}) => ({durationInFrames: mercadoDuration(props as MercadoProps)})} {...common} />
    <Composition id="Rumor" component={Rumor} durationInFrames={RUMOR_TOTAL} defaultProps={sampleRumor as RumorProps} calculateMetadata={({props}) => ({durationInFrames: rumorDuration(props as RumorProps)})} {...common} />
    <Composition id="EstaSemana" component={EstaSemana} durationInFrames={SEMANA_TOTAL} defaultProps={sampleSemana as SemanaProps} calculateMetadata={({props}) => ({durationInFrames: semanaDuration(props as SemanaProps)})} {...common} />
  </>
);
