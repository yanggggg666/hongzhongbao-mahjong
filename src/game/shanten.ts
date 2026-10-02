/**
 * 向听数（Shanten）计算
 * 参考开源项目 MahjongRepository/mahjong（MIT 协议）
 * 向听数 = 距离听牌还差几张牌（-1=已胡，0=听牌，1=一向听...）
 */

/**
 * 计算标准型向听数
 * @param counts 28 种牌的数量（0-26 序数牌，27 红中）
 * @param melds 已副露的面子数（0-4）
 */
export function calculateShanten(counts: number[], melds: number = 0): number {
  const suitCounts = [counts.slice(0, 9), counts.slice(9, 18), counts.slice(18, 27)];
  const honorCounts = counts[27]; // 红中

  let best = 8;

  // 遍历所有可能的将牌选择（含红中作将）
  for (let pairIdx = -1; pairIdx < 28; pairIdx++) {
    const c = counts.slice();
    let hasPair = false;
    if (pairIdx >= 0) {
      if (c[pairIdx] >= 2) {
        c[pairIdx] -= 2;
        hasPair = true;
      } else {
        continue;
      }
    }
    const result = decompose(c, suitCounts.map((s, i) => {
      const sc = s.slice();
      if (pairIdx >= 0 && pairIdx < 27) {
        const suit = Math.floor(pairIdx / 9);
        if (i === suit) sc[pairIdx % 9] -= 2;
      }
      return sc;
    }), honorCounts - (pairIdx === 27 ? 2 : 0), melds, hasPair);
    if (result < best) best = result;
  }

  return best;
}

/**
 * 递归分解手牌为面子+搭子，返回最小向听数
 */
function decompose(
  _counts: number[],
  suits: number[][],
  honors: number,
  melds: number,
  hasPair: boolean
): number {
  // 找到第一个有牌的索引
  let best = 8;

  // 尝试从每个花色中取面子
  for (let s = 0; s < 3; s++) {
    const sc = suits[s];
    for (let i = 0; i < 9; i++) {
      if (sc[i] === 0) continue;

      // 刻子
      if (sc[i] >= 3) {
        sc[i] -= 3;
        const r = decompose(_counts, suits, honors, melds + 1, hasPair);
        if (r < best) best = r;
        sc[i] += 3;
      }

      // 顺子
      if (i <= 6 && sc[i + 1] > 0 && sc[i + 2] > 0) {
        sc[i]--; sc[i + 1]--; sc[i + 2]--;
        const r = decompose(_counts, suits, honors, melds + 1, hasPair);
        if (r < best) best = r;
        sc[i]++; sc[i + 1]++; sc[i + 2]++;
      }

      // 搭子：对子
      if (sc[i] >= 2) {
        sc[i] -= 2;
        const r = decompose(_counts, suits, honors, melds, hasPair);
        if (r < best) best = r;
        sc[i] += 2;
      }

      // 搭子：两面/边张/坎张
      if (i <= 7 && sc[i + 1] > 0) {
        sc[i]--; sc[i + 1]--;
        const r = decompose(_counts, suits, honors, melds, hasPair);
        if (r < best) best = r;
        sc[i]++; sc[i + 1]++;
      }
      if (i <= 6 && sc[i + 2] > 0) {
        sc[i]--; sc[i + 2]--;
        const r = decompose(_counts, suits, honors, melds, hasPair);
        if (r < best) best = r;
        sc[i]++; sc[i + 2]++;
      }

      // 孤张（跳过这张牌）
      sc[i]--;
      const r = decompose(_counts, suits, honors, melds, hasPair);
      if (r < best) best = r;
      sc[i]++;

      break; // 只处理第一个有牌的索引
    }
  }

  // 红中作刻子/对子/孤张
  if (honors >= 3) {
    const r = decompose(_counts, suits, honors - 3, melds + 1, hasPair);
    if (r < best) best = r;
  }
  if (honors >= 2) {
    const r = decompose(_counts, suits, honors - 2, melds, hasPair);
    if (r < best) best = r;
  }
  if (honors >= 1) {
    const r = decompose(_counts, suits, honors - 1, melds, hasPair);
    if (r < best) best = r;
  }

  // 计算当前状态的向听数
  let totalMelds = melds;
  let partialSets = 0;
  let pair = hasPair ? 1 : 0;

  // 统计各花色的搭子数
  for (let s = 0; s < 3; s++) {
    const sc = suits[s];
    for (let i = 0; i < 9; i++) {
      if (sc[i] >= 2) partialSets++;
      if (i <= 7 && sc[i] > 0 && sc[i + 1] > 0) partialSets++;
      if (i <= 6 && sc[i] > 0 && sc[i + 2] > 0) partialSets++;
    }
  }
  if (honors >= 2) partialSets++;

  // 向听数公式：8 - 面子*2 - 搭子 - 将
  // 约束：面子+搭子 <= 4（不算将）
  const groups = totalMelds + partialSets;
  const cappedGroups = Math.min(groups, 4);
  const shanten = 8 - totalMelds * 2 - (cappedGroups - totalMelds) - pair;

  return Math.min(best, shanten);
}

/**
 * 七对向听数
 */
export function calculateChiitoitsuShanten(counts: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 28; i++) {
    if (counts[i] >= 2) pairs++;
    if (counts[i] >= 1) kinds++;
  }
  // 七对：需要 7 个对子，且至少 7 种不同的牌
  let shanten = 6 - pairs;
  if (kinds < 7) shanten += 7 - kinds;
  return shanten;
}

/**
 * 综合向听数（标准型 + 七对）
 */
export function calculateBestShanten(counts: number[], melds: number = 0): number {
  const standard = calculateShanten(counts, melds);
  const chiitoitsu = calculateChiitoitsuShanten(counts);
  return Math.min(standard, chiitoitsu);
}
