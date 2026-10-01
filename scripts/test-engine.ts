/**
 * 游戏引擎自动化测试（纯逻辑，无网络/UI）：
 * 1. 胡牌判定单元测试（标准胡、红中万能、七对、散牌）
 * 2. 4 个 AI 自动打 3 局完整游戏，验证状态机不崩溃、计分正确
 * 运行：npm run test
 */
import { MahjongEngine } from '../src/game/engine';
import { tileType, HONGZHONG_TYPE } from '../src/game/tiles';
import { canWinStandard, canWinSevenPairs } from '../src/game/rules';
import { aiChooseDiscard } from '../src/game/ai';
import { Tile, Suit } from '../src/game/types';

function makeTile(suit: Suit, rank: number, id: number): Tile {
  return { id, suit, rank };
}

function countsOf(tiles: Tile[]): number[] {
  const counts = new Array(28).fill(0);
  for (const t of tiles) counts[tileType(t)]++;
  return counts;
}

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`);
  }
}

console.log('== 胡牌判定测试 ==');

// 标准胡：3 顺子 + 刻子 + 将
const hand1 = [
  makeTile('wan', 1, 0), makeTile('wan', 2, 1), makeTile('wan', 3, 2),
  makeTile('wan', 4, 3), makeTile('wan', 5, 4), makeTile('wan', 6, 5),
  makeTile('wan', 7, 6), makeTile('wan', 8, 7), makeTile('wan', 9, 8),
  makeTile('tiao', 1, 9), makeTile('tiao', 1, 10), makeTile('tiao', 1, 11),
  makeTile('tong', 5, 12), makeTile('tong', 5, 13),
];
const c1 = countsOf(hand1);
assert(canWinStandard(c1, 0), '标准胡（顺子+刻子+将）');

// 红中作万能牌补顺子
const hand2 = [
  makeTile('wan', 1, 0), makeTile('wan', 2, 1), makeTile('hongzhong', 0, 2),
  makeTile('wan', 4, 3), makeTile('wan', 5, 4), makeTile('wan', 6, 5),
  makeTile('wan', 7, 6), makeTile('wan', 8, 7), makeTile('wan', 9, 8),
  makeTile('tiao', 1, 9), makeTile('tiao', 1, 10), makeTile('tiao', 1, 11),
  makeTile('tong', 5, 12), makeTile('tong', 5, 13),
];
const c2 = countsOf(hand2);
const w2 = c2[HONGZHONG_TYPE];
c2[HONGZHONG_TYPE] = 0;
assert(canWinStandard(c2, w2), '红中万能牌（补顺子）');

// 红中作将牌
const hand2b = [
  makeTile('wan', 1, 0), makeTile('wan', 2, 1), makeTile('wan', 3, 2),
  makeTile('wan', 4, 3), makeTile('wan', 5, 4), makeTile('wan', 6, 5),
  makeTile('wan', 7, 6), makeTile('wan', 8, 7), makeTile('wan', 9, 8),
  makeTile('tiao', 1, 9), makeTile('tiao', 1, 10), makeTile('tiao', 1, 11),
  makeTile('hongzhong', 0, 12), makeTile('hongzhong', 0, 13),
];
const c2b = countsOf(hand2b);
const w2b = c2b[HONGZHONG_TYPE];
c2b[HONGZHONG_TYPE] = 0;
assert(canWinStandard(c2b, w2b), '红中作将牌');

// 七对
const hand3 = [
  makeTile('wan', 1, 0), makeTile('wan', 1, 1),
  makeTile('wan', 2, 2), makeTile('wan', 2, 3),
  makeTile('wan', 3, 4), makeTile('wan', 3, 5),
  makeTile('wan', 4, 6), makeTile('wan', 4, 7),
  makeTile('wan', 5, 8), makeTile('wan', 5, 9),
  makeTile('wan', 6, 10), makeTile('wan', 6, 11),
  makeTile('tong', 7, 12), makeTile('tong', 7, 13),
];
assert(canWinSevenPairs(countsOf(hand3), 0), '七对');

// 七对带红中
const hand4 = [
  makeTile('wan', 1, 0), makeTile('wan', 1, 1),
  makeTile('wan', 2, 2), makeTile('wan', 2, 3),
  makeTile('wan', 3, 4), makeTile('wan', 3, 5),
  makeTile('wan', 4, 6), makeTile('wan', 4, 7),
  makeTile('wan', 5, 8), makeTile('wan', 5, 9),
  makeTile('wan', 6, 10), makeTile('hongzhong', 0, 11),
  makeTile('tong', 7, 12), makeTile('tong', 7, 13),
];
const c4 = countsOf(hand4);
const w4 = c4[HONGZHONG_TYPE];
c4[HONGZHONG_TYPE] = 0;
assert(canWinSevenPairs(c4, w4), '七对带红中');

// 散牌不能胡
const hand5 = [
  makeTile('wan', 1, 0), makeTile('wan', 3, 1), makeTile('wan', 5, 2),
  makeTile('wan', 7, 3), makeTile('wan', 9, 4),
  makeTile('tiao', 1, 5), makeTile('tiao', 3, 6), makeTile('tiao', 5, 7),
  makeTile('tiao', 7, 8), makeTile('tiao', 9, 9),
  makeTile('tong', 1, 10), makeTile('tong', 3, 11), makeTile('tong', 5, 12), makeTile('tong', 7, 13),
];
const c5 = countsOf(hand5);
const w5 = c5[HONGZHONG_TYPE];
c5[HONGZHONG_TYPE] = 0;
assert(!canWinStandard(c5, w5) && !canWinSevenPairs(c5, w5), '散牌不能胡');

console.log('== AI 整局测试（4 电脑打 3 局）==');

const engine = new MahjongEngine();
engine.setup([
  { name: 'AI1', isAI: true },
  { name: 'AI2', isAI: true },
  { name: 'AI3', isAI: true },
  { name: 'AI4', isAI: true },
]);

let rounds = 0;
let wins = 0;
let liuju = 0;
engine.onChange = () => {
  const s = engine.state;
  if (s.phase === 'playing' && s.players[s.currentPlayer]?.isAI) {
    if (s.canZimo) {
      engine.zimoHu(s.currentPlayer);
      return;
    }
    const tileId = aiChooseDiscard(s.players[s.currentPlayer].hand);
    engine.discard(s.currentPlayer, tileId);
  } else if (s.phase === 'claim') {
    for (const claim of s.claims) {
      if (s.claimResponses[claim.player]) continue;
      // 简单 AI：能胡就胡，否则过
      engine.respondClaim(claim.player, claim.type === 'hu' ? 'hu' : 'pass');
    }
  } else if (s.phase === 'roundEnd') {
    rounds++;
    if (s.winners.length > 0) wins++;
    else liuju++;
    if (rounds < 3) {
      engine.nextRound();
    } else {
      const scoreSum = engine.state.players.reduce((sum, p) => sum + p.score, 0);
      assert(rounds === 3, `完成 3 局（实际 ${rounds}）`);
      assert(scoreSum === 0, `计分守恒（总和 ${scoreSum}）`);
      console.log(`  结果: ${wins} 局有人胡牌, ${liuju} 局流局`);
      console.log(`  比分: ${engine.state.players.map((p) => `${p.name}:${p.score}`).join('  ')}`);
      console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);
      process.exit(failed > 0 ? 1 : 0);
    }
  }
};
engine.startRound();
