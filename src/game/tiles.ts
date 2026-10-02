import { Tile, Suit } from './types';

export const HONGZHONG_TYPE = 31; // 中（红中）的牌型编号

/** 牌型编号：0-8 万、9-17 条、18-26 筒、27-30 东南西北、31 中、32 发、33 白 */
export function tileType(t: Tile): number {
  if (t.suit === 'hongzhong') return HONGZHONG_TYPE;
  if (t.suit === 'feng') return 27 + (t.rank - 1); // 1-4 → 27-30
  if (t.suit === 'jian') return 31 + (t.rank - 1); // 1-3 → 31-33
  const base = t.suit === 'wan' ? 0 : t.suit === 'tiao' ? 9 : 18;
  return base + t.rank - 1;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return tileType(a) === tileType(b);
}

/** 创建标准 136 张牌：万/条/筒各 36 + 风 16 + 箭 12 */
export function buildWall(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  const suits: Suit[] = ['wan', 'tiao', 'tong'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let c = 0; c < 4; c++) tiles.push({ id: id++, suit, rank });
    }
  }
  // 风牌：东南西北
  const fengNames = ['东', '南', '西', '北'];
  for (let rank = 1; rank <= 4; rank++) {
    for (let c = 0; c < 4; c++) tiles.push({ id: id++, suit: 'feng', rank });
  }
  // 箭牌：中发白
  const jianNames = ['中', '发', '白'];
  for (let rank = 1; rank <= 3; rank++) {
    for (let c = 0; c < 4; c++) tiles.push({ id: id++, suit: 'jian', rank });
  }
  return tiles;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const NUM_CHAR = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT_CHAR: Record<string, string> = { wan: '万', tiao: '条', tong: '筒' };
const FENG_CHAR = ['', '东', '南', '西', '北'];
const JIAN_CHAR = ['', '中', '发', '白'];

export function tileLabel(t: Tile): string {
  if (t.suit === 'feng') return FENG_CHAR[t.rank];
  if (t.suit === 'jian') return JIAN_CHAR[t.rank];
  return `${NUM_CHAR[t.rank]}${SUIT_CHAR[t.suit]}`;
}

const SUIT_ORDER: Record<Suit, number> = { wan: 0, tiao: 1, tong: 2, feng: 3, jian: 4, hongzhong: 5 };
export function sortHand(hand: Tile[]): Tile[] {
  return hand.slice().sort((a, b) => {
    const sa = SUIT_ORDER[a.suit];
    const sb = SUIT_ORDER[b.suit];
    if (sa !== sb) return sa - sb;
    return a.rank - b.rank;
  });
}
