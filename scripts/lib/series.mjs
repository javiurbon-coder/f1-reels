import fs from 'node:fs';
export const loadSeries = () => JSON.parse(fs.readFileSync('config/series.json', 'utf8'));
export const seriesOf = (composition) => loadSeries().find((s) => s.composition === composition)?.id ?? 'otros';
