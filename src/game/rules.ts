import { Tile, Meld } from './types';
import { tileType, sameTile, HONGZHONG_TYPE } from './tiles';

export { tileType, sameTile };

export const TYPE_COUNT = 28;

export function handCounts(hand: Tile[]): number[] {
  const counts = new Array(TYPE_COUNT).fill(0);
  for (const t of hand) counts[tileType(t)]++;
  return counts;
}

export function countHongzhong(tiles: Tile[]): number {
  return tiles.filter((t) => t.suit === 'hongzhong').length;
}

/**
 * 判断 counts（27 种序数牌）+ wilds 张红中能否组成 needed 个面子。
 * 红中作万能牌：可补刻子、顺子，3 张红中可自行组成刻子。
 */
function canFormMelds(counts: number[], wilds: number, needed: number): boolean {
  if (needed === 0) {
    for (let i = 0; i < 27; i++) if (counts[i] !== 0) return false;
    return wilds === 0;
  }
  let i = 0;
  while (i < 27 && counts[i] === 0) i++;
  if (i === 27) return wilds === needed * 3; // 只剩红中，只能自行组成刻子

  // 刻子：3 张相同
  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (canFormMelds(counts, wilds, needed - 1)) {
      counts[i] += 3;
      return true;
    }
    counts[i] += 3;
  }
  // 刻子：2 张 + 1 红中
  if (counts[i] >= 2 && wilds >= 1) {
    counts[i] -= 2;
    if (canFormMelds(counts, wilds - 1, needed - 1)) {
      counts[i] += 2;
      return true;
    }
    counts[i] += 2;
  }
  // 刻子：1 张 + 2 红中
  if (counts[i] >= 1 && wilds >= 2) {
    counts[i] -= 1;
    if (canFormMelds(counts, wilds - 2, needed - 1)) {
      counts[i] += 1;
      return true;
    }
    counts[i] += 1;
  }
  // 顺子：i, i+1, i+2
  if (i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    if (canFormMelds(counts, wilds, needed - 1)) {
      counts[i]++;
      counts[i + 1]++;
      counts[i + 2]++;
      return true;
    }
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
  }
  // 顺子：i, i+1 + 1 红中（作 i+2）
  if (i % 9 <= 6 && counts[i + 1] > 0 && wilds >= 1) {
    counts[i]--;
    counts[i + 1]--;
    if (canFormMelds(counts, wilds - 1, needed - 1)) {
      counts[i]++;
      counts[i + 1]++;
      return true;
    }
    counts[i]++;
    counts[i + 1]++;
  }
  // 顺子：i + 1 红中（作 i+1）, i+2
  if (i % 9 <= 6 && counts[i + 2] > 0 && wilds >= 1) {
    counts[i]--;
    counts[i + 2]--;
    if (canFormMelds(counts, wilds - 1, needed - 1)) {
      counts[i]++;
      counts[i + 2]++;
      return true;
    }
    counts[i]++;
    counts[i + 2]++;
  }
  // 顺子：i + 2 红中（作 i+1, i+2）
  if (i % 9 <= 6 && wilds >= 2) {
    counts[i]--;
    if (canFormMelds(counts, wilds - 2, needed - 1)) {
      counts[i]++;
      return true;
    }
    counts[i]++;
  }
  return false;
}

/** 标准胡：4 面子 + 1 对将 */
export function canWinStandard(counts: number[], wilds: number): boolean {
  for (let p = 0; p < 27; p++) {
    for (let w = 0; w <= Math.min(2, wilds); w++) {
      if (counts[p] + w < 2) continue;
      const c = counts.slice();
      c[p] -= 2 - w;
      if (canFormMelds(c, wilds - w, 4)) return true;
    }
  }
  return false;
}

/** 七对：7 个对子（红中可配对） */
export function canWinSevenPairs(counts: number[], wilds: number): boolean {
  let pairs = 0;
  let singles = 0;
  for (let i = 0; i < 27; i++) {
    pairs += Math.floor(counts[i] / 2);
    if (counts[i] % 2 === 1) singles++;
  }
  if (singles > wilds) return false;
  const rest = wilds - singles;
  if (rest % 2 !== 0) return false;
  return pairs + singles + rest / 2 === 7;
}

export function canWin(counts: number[], wilds: number): boolean {
  return canWinStandard(counts, wilds) || canWinSevenPairs(counts, wilds);
}

/** 手牌（13 张）加上 tile 能否胡 */
export function canHuWithTile(hand: Tile[], tile: Tile): boolean {
  const counts = handCounts(hand);
  counts[tileType(tile)]++;
  const wilds = counts[HONGZHONG_TYPE];
  counts[HONGZHONG_TYPE] = 0;
  return canWin(counts, wilds);
}

/** 手牌是否已胡（自摸判定，14 张） */
export function handCanWin(hand: Tile[]): boolean {
  const counts = handCounts(hand);
  const wilds = counts[HONGZHONG_TYPE];
  counts[HONGZHONG_TYPE] = 0;
  return canWin(counts, wilds);
}

/** 是否只能组成刻子（对对胡判定用） */
function canFormOnlyTriplets(counts: number[], wilds: number, needed: number): boolean {
  if (needed === 0) {
    for (let i = 0; i < 27; i++) if (counts[i] !== 0) return false;
    return wilds === 0;
  }
  let i = 0;
  while (i < 27 && counts[i] === 0) i++;
  if (i === 27) return wilds === needed * 3;
  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (canFormOnlyTriplets(counts, wilds, needed - 1)) {
      counts[i] += 3;
      return true;
    }
    counts[i] += 3;
  }
  if (counts[i] >= 2 && wilds >= 1) {
    counts[i] -= 2;
    if (canFormOnlyTriplets(counts, wilds - 1, needed - 1)) {
      counts[i] += 2;
      return true;
    }
    counts[i] += 2;
  }
  if (counts[i] >= 1 && wilds >= 2) {
    counts[i] -= 1;
    if (canFormOnlyTriplets(counts, wilds - 2, needed - 1)) {
      counts[i] += 1;
      return true;
    }
    counts[i] += 1;
  }
  return false;
}

function isQingyise(tiles: Tile[]): boolean {
  const suits = new Set<string>();
  for (const t of tiles) {
    if (t.suit !== 'hongzhong') suits.add(t.suit);
  }
  return suits.size <= 1;
}

export interface WinDetail {
  qidui: boolean;
  duiduihu: boolean;
  qingyise: boolean;
  hongzhongCount: number;
  fan: string[];
}

/** 计算胡牌详情（不计番名外的分数） */
export function calcWinDetail(hand: Tile[], melds: Meld[], winTile: Tile | null): WinDetail {
  const allTiles: Tile[] = [...hand, ...melds.flatMap((m) => m.tiles)];
  const inHand = winTile ? hand.some((t) => t.id === winTile.id) : true;
  if (winTile && !inHand) allTiles.push(winTile);

  const hongzhongCount = countHongzhong(allTiles);
  const counts = handCounts(hand);
  if (winTile && !inHand) counts[tileType(winTile)]++;
  const wilds = counts[HONGZHONG_TYPE];
  counts[HONGZHONG_TYPE] = 0;

  const qidui = canWinSevenPairs(counts, wilds);
  const duiduihu =
    melds.every((m) => m.type !== 'chi') && canFormOnlyTriplets(counts, wilds, 4 - melds.length);
  const qingyise = isQingyise(allTiles);

  const fan: string[] = [];
  if (qidui) fan.push('七对');
  if (duiduihu) fan.push('对对胡');
  if (qingyise) fan.push('清一色');
  if (hongzhongCount > 0) fan.push(`红中×${hongzhongCount}`);
  return { qidui, duiduihu, qingyise, hongzhongCount, fan };
}
