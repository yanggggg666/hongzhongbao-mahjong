import { Tile, Meld, Claim, WinInfo } from '../game/types';

/** 客户端看到的玩家信息（他人手牌不可见） */
export interface ClientPlayer {
  id: number;
  name: string;
  isAI: boolean;
  handCount: number;
  hand: Tile[] | null; // 仅自己可见
  melds: Meld[];
  discards: Tile[];
  score: number;
}

export interface ClientGameState {
  phase: string;
  players: ClientPlayer[];
  wallCount: number;
  currentPlayer: number;
  dealer: number;
  roundNumber: number;
  lastDiscard: { tile: Tile; player: number } | null;
  lastDraw: Tile | null; // 自己最近摸到的牌（高亮用）
  claims: Claim[]; // 当前玩家可响应的操作
  canZimo: boolean;
  winners: number[];
  winInfo: WinInfo[] | null;
  message: string;
  myPlayerId: number;
  amHost: boolean;
}

export interface LobbyState {
  players: { id: number; name: string; isAI: boolean }[];
  aiCount: number;
  hostId: number;
  myPlayerId: number;
}

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'discard'; tileId: number }
  | { type: 'claim'; action: 'pass' | 'hu' | 'gang' | 'peng' | 'chi'; optionTiles?: Tile[] }
  | { type: 'angang'; tileId: number }
  | { type: 'jiagang'; tileId: number }
  | { type: 'zimoHu' }
  | { type: 'nextRound' };

export type ServerMessage =
  | { type: 'welcome'; playerId: number }
  | { type: 'lobby'; lobby: LobbyState }
  | { type: 'state'; state: ClientGameState }
  | { type: 'error'; message: string };
