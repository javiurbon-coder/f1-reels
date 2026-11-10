export type Timed = {from: number; to: number};
export type Scene = Timed &
  (
    | {type: 'hook'}
    | {type: 'sources'}
    | {type: 'point'; text: string; hl?: string[]; icon?: 'trophy' | 'stopwatch' | 'doc' | 'wrench' | 'flag'}
    | {type: 'stat'; value: number; label: string; title: string}
    | {type: 'bars'; title: string; hl?: string; rows: {name: string; grid: number; finish: number; color: string; me?: boolean}[]}
    | {type: 'streak'; title: string; items: {label: string; pos: number; dnf: boolean}[]}
    | {type: 'rank'; title: string; unit: string; rows: {name: string; value: number; color: string; me?: boolean}[]}
  );
