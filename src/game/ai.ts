import { Tile, Meld, Claim } from './types';
import { tileType, HONGZHONG_TYPE } from './tiles';
import { handCounts } from './rules';
import { calculateBestShanten } from './shanten';
import { ClaimAction } from './engine';

/** 计算打出某张牌后的向听数 */
function shantenAfterDiscard(hand: Tile[], tile: Tile, melds: number): number {
  const counts = handCounts(hand);
  counts[tileType(tile)]--;
  return calculateBestShanten(counts, melds);
}

/** AI 选择要打出的牌：选择使向听数最小的打法 */
export function aiChooseDiscard(hand: Tile[]): number {
  const melds = 0; // 手牌中的面子数需要外部传入，这里简化
  let bestId = hand[0].id;
  let bestShanten = Infinity;

  // 评估每张牌
  const evaluated = new Map<number, number>();
  for (const tile of hand) {
    const s = shantenAfterDiscard(hand, tile, melds);
    evaluated.set(tile.id, s);
    if (s < bestShanten) {
      bestShanten = s;
      bestId = tile.id;
    }
  }

  // 如果有多张牌向听数相同，选择"价值"最低的（孤张优先打）
  const candidates = hand.filter((t) => evaluated.get(t.id) === bestShanten);
  if (candidates.length > 1) {
    let worst = candidates[0];
    let worstScore = -Infinity;
    for (const t of candidates) {
      const score = tileIsolationScore(hand, t);
      if (score > worstScore) {
        worstScore = score;
        worst = t;
      }
    }
    return worst.id;
  }
  return bestId;
}

/** 评估一张牌的"孤立程度"（越高越应该打掉） */
function tileIsolationScore(hand: Tile[], tile: Tile): number {
  if (tile.suit === 'hongzhong') return -100; // 红中必留
  const t = tileType(tile);
  const rank = t % 9;
  const counts = handCounts(hand);
  let score = 0;
  // 孤张加分
  if (counts[t] === 1) score += 10;
  // 远离其他牌加分
  if (rank > 0 && counts[t - 1] === 0) score += 3;
  if (rank < 8 && counts[t + 1] === 0) score += 3;
  if (rank > 1 && counts[t - 2] === 0) score += 2;
  if (rank < 7 && counts[t + 2] === 0) score += 2;
  return score;
}

/** AI 决定是否吃/碰/杠/胡 */
export function aiChooseClaim(
  hand: Tile[],
  melds: Meld[],
  claim: Claim
): { action: ClaimAction; optionTiles?: Tile[] } {
  if (claim.type === 'hu') return { action: 'hu' };
  if (claim.type === 'gang') return { action: 'gang' };

  const meldCount = melds.length;
  const currentShanten = calculateBestShanten(handCounts(hand), meldCount);

  if (claim.type === 'peng') {
    // 碰后向听数不变差才碰
    const tile = claim.tiles[0];
    const counts = handCounts(hand);
    counts[tileType(tile)] -= 2;
    const afterShanten = calculateBestShanten(counts, meldCount + 1);
    if (afterShanten <= currentShanten) return { action: 'peng' };
    return { action: 'pass' };
  }

  if (claim.type === 'chi') {
    // 吃后向听数变好才吃
    if (!claim.options || claim.options.length === 0) return { action: 'pass' };
    let bestOption = claim.options[0];
    let bestShanten = currentShanten;
    for (const opt of claim.options) {
      const counts = handCounts(hand);
      for (const t of opt) counts[tileType(t)]--;
      const s = calculateBestShanten(counts, meldCount + 1);
      if (s < bestShanten) {
        bestShanten = s;
        bestOption = opt;
      }
    }
    if (bestShanten < currentShanten) return { action: 'chi', optionTiles: bestOption };
    return { action: 'pass' };
  }

  return { action: 'pass' };
}

/** 供 UI 提示：手牌中可暗杠的牌 */
export function findAngangTiles(hand: Tile[]): Tile[] {
  const counts = handCounts(hand);
  const result: Tile[] = [];
  for (const t of hand) {
    const type = tileType(t);
    if (type !== HONGZHONG_TYPE && counts[type] === 4 && !result.some((r) => tileType(r) === type)) {
      result.push(t);
    }
  }
  return result;
}

/** 供 UI 提示：手牌中可补杠的牌（与已有碰相同） */
export function findJiagangTiles(hand: Tile[], melds: Meld[]): Tile[] {
  const result: Tile[] = [];
  for (const m of melds) {
    if (m.type !== 'peng') continue;
    const t = hand.find((h) => h.suit === m.tiles[0].suit && h.rank === m.tiles[0].rank);
    if (t && !result.some((r) => r.id === t.id)) result.push(t);
  }
  return result;
}
