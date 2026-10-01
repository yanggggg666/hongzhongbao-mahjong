import { Tile, Meld, Claim } from './types';
import { tileType, HONGZHONG_TYPE } from './tiles';
import { handCounts } from './rules';
import { ClaimAction } from './engine';

/** 评估手牌中每张牌的利用价值，越低越应该打出 */
function tileUsefulness(hand: Tile[], tile: Tile): number {
  if (tile.suit === 'hongzhong') return 1000; // 红中是万能牌，必留
  const t = tileType(tile);
  const rank = t % 9;
  const counts = handCounts(hand);
  let score = 0;
  score += counts[t] * 15; // 相同牌
  if (rank > 0) score += counts[t - 1] * 6; // 相邻
  if (rank < 8) score += counts[t + 1] * 6;
  if (rank > 1) score += counts[t - 2] * 3; // 隔一张
  if (rank < 7) score += counts[t + 2] * 3;
  if (counts[t] >= 2) score += 10; // 对子加成
  return score;
}

/** AI 选择要打出的牌 */
export function aiChooseDiscard(hand: Tile[]): number {
  let bestId = hand[0].id;
  let bestScore = Infinity;
  for (const tile of hand) {
    const score = tileUsefulness(hand, tile);
    if (score < bestScore) {
      bestScore = score;
      bestId = tile.id;
    }
  }
  return bestId;
}

/** AI 决定是否吃/碰/杠/胡 */
export function aiChooseClaim(
  hand: Tile[],
  melds: Meld[],
  claim: Claim
): { action: ClaimAction; optionTiles?: Tile[] } {
  if (claim.type === 'hu') return { action: 'hu' };
  if (claim.type === 'gang') return { action: 'gang' };
  if (claim.type === 'peng') {
    // 碰一般不亏；手牌接近七对时保留灵活性
    if (melds.length >= 3 && Math.random() < 0.3) return { action: 'pass' };
    return { action: 'peng' };
  }
  if (claim.type === 'chi') {
    // 牌数少、面子少时才吃，否则保持门清
    if (melds.length <= 1 && claim.options && claim.options.length > 0) {
      return { action: 'chi', optionTiles: claim.options[0] };
    }
    return { action: 'pass' };
  }
  return { action: 'pass' };
}

/** AI 是否暗杠/补杠：默认总是杠（可多摸一张牌） */
export function aiWantKong(): boolean {
  return true;
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
