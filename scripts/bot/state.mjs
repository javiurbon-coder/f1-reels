import fs from 'node:fs';
const FILE = 'data/state/bot.json';
export const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {offset: 0, more: 0, items: {}});
export const save = (s) => { fs.mkdirSync('data/state', {recursive: true}); fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); };
