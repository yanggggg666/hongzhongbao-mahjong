export type Suit = 'wan' | 'tiao' | 'tong' | 'feng' | 'jian' | 'hongzhong';

export interface Tile {
  id: number; // 0-111 唯一编号
  suit: Suit;
  rank: number; // 1-9；红中为 0
}

export type MeldType = 'chi' | 'peng' | 'minggang' | 'angang' | 'jiagang';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  from: number; // 来源玩家下标（吃/碰/杠），暗杠为自己
}

export interface Player {
  id: number;
  name: string;
  isAI: boolean;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  score: number;
}

export type ClaimType = 'hu' | 'gang' | 'peng' | 'chi';

export interface Claim {
  player: number;
  type: ClaimType;
  tiles: Tile[]; // 碰/杠：从手牌取出的牌；吃：选定的 2 张；胡：空数组
  options?: Tile[][]; // 吃：所有可选组合
}

export type ClaimResponse = { action: 'pass' } | { action: ClaimType; tiles: Tile[] };

export interface WinInfo {
  winner: number;
  from: number | null; // null = 自摸
  tile: Tile | null;
  zimo: boolean;
  qianggang: boolean;
  gangshanghua: boolean;
  qidui: boolean;
  duiduihu: boolean;
  qingyise: boolean;
  hongzhongCount: number;
  points: number;
  fan: string[];
}

export type GamePhase = 'lobby' | 'playing' | 'claim' | 'roundEnd';

export interface GameState {
  phase: GamePhase;
  players: Player[];
  wallCount: number;
  currentPlayer: number;
  dealer: number;
  roundNumber: number;
  lastDiscard: { tile: Tile; player: number } | null;
  lastDraw: Tile | null;
  lastDrawFromGang: boolean;
  canZimo: boolean;
  claims: Claim[];
  claimResponses: Record<number, ClaimResponse>;
  pendingJiagang: { player: number; tile: Tile; meld: Meld } | null;
  winners: number[];
  winInfo: WinInfo[] | null;
  message: string;
}
