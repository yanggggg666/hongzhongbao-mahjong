import { Tile, Suit } from './types';

export const HONGZHONG_TYPE = 27;

/** 牌型编号：0-8 万、9-17 条、18-26 筒、27 红中 */
export function tileType(t: Tile): number {
  if (t.suit === 'hongzhong') return HONGZHONG_TYPE;
  const base = t.suit === 'wan' ? 0 : t.suit === 'tiao' ? 9 : 18;
  return base + t.rank - 1;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return tileType(a) === tileType(b);
}

export const HONGZHONG_COUNT = 4;

/** 创建一副完整的红中宝牌：万/条/筒各 1-9 四张 + 4 张红中 = 112 张 */
export function buildWall(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  const suits: Suit[] = ['wan', 'tiao', 'tong'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let c = 0; c < 4; c++) {
        tiles.push({ id: id++, suit, rank });
      }
    }
  }
  for (let c = 0; c < HONGZHONG_COUNT; c++) {
    tiles.push({ id: id++, suit: 'hongzhong', rank: 0 });
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

const SUIT_CHAR: Record<Suit, string> = {
  wan: '万',
  tiao: '条',
  tong: '筒',
  hongzhong: '',
};

const NUM_CHAR = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function tileLabel(t: Tile): string {
  if (t.suit === 'hongzhong') return '红中';
  return `${NUM_CHAR[t.rank]}${SUIT_CHAR[t.suit]}`;
}

const SUIT_ORDER: Record<Suit, number> = { wan: 0, tiao: 1, tong: 2, hongzhong: 3 };

export function sortHand(hand: Tile[]): Tile[] {
  return hand.slice().sort((a, b) => {
    const sa = SUIT_ORDER[a.suit];
    const sb = SUIT_ORDER[b.suit];
    if (sa !== sb) return sa - sb;
    return a.rank - b.rank;
  });
}
