import { Tile, Player, Meld, Claim, GameState, WinInfo, ClaimResponse } from './types';
import { buildWall, shuffle, tileType, sameTile, HONGZHONG_TYPE } from './tiles';
import { canHuWithTile, handCanWin, calcWinDetail } from './rules';

export interface EnginePlayerConfig {
  name: string;
  isAI: boolean;
}

export type ClaimAction = 'pass' | 'hu' | 'gang' | 'peng' | 'chi';

export class MahjongEngine {
  state: GameState;
  private wall: Tile[] = [];
  private rng: () => number;
  private drawingForGang = false;
  onChange: (() => void) | null = null;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.state = {
      phase: 'lobby',
      players: [],
      wallCount: 0,
      currentPlayer: 0,
      dealer: 0,
      roundNumber: 0,
      lastDiscard: null,
      lastDraw: null,
      lastDrawFromGang: false,
      canZimo: false,
      claims: [],
      claimResponses: {},
      pendingJiagang: null,
      winners: [],
      winInfo: null,
      message: '',
    };
  }

  get wallSize(): number {
    return this.wall.length;
  }

  private emit() {
    this.onChange?.();
  }

  setup(configs: EnginePlayerConfig[]) {
    this.state.players = configs.map((c, i) => ({
      id: i,
      name: c.name,
      isAI: c.isAI,
      hand: [],
      melds: [],
      discards: [],
      score: 0,
    }));
    this.state.phase = 'lobby';
    this.state.roundNumber = 0;
    this.state.dealer = 0;
    this.emit();
  }

  startRound() {
    const n = this.state.players.length;
    if (n < 2) throw new Error('至少需要 2 名玩家');
    this.wall = shuffle(buildWall(), this.rng);
    for (const p of this.state.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
    }
    // 136 张牌，每人 13 张
    for (let r = 0; r < 13; r++) {
      for (let i = 0; i < n; i++) {
        this.state.players[i].hand.push(this.wall.pop()!);
      }
    }
    this.state.roundNumber++;
    this.state.winners = [];
    this.state.winInfo = null;
    this.state.lastDiscard = null;
    this.state.lastDraw = null;
    this.state.pendingJiagang = null;
    this.state.claims = [];
    this.state.claimResponses = {};
    this.state.currentPlayer = this.state.dealer;
    this.state.message = `第 ${this.state.roundNumber} 局开始，${this.state.players[this.state.dealer].name} 庄家`;
    this.drawForCurrent();
  }

  nextRound() {
    const s = this.state;
    if (s.phase !== 'roundEnd') return;
    // 有赢家则赢家坐庄，否则轮转
    if (s.winners.length > 0) s.dealer = s.winners[0];
    else s.dealer = (s.dealer + 1) % s.players.length;
    this.startRound();
  }

  /** 当前玩家摸牌；牌墙空则流局 */
  private drawForCurrent(): boolean {
    const s = this.state;
    const tile = this.wall.pop();
    if (!tile) {
      this.endRound([], { zimo: false, tile: null, reason: '流局，牌墙已空' });
      return false;
    }
    const p = s.players[s.currentPlayer];
    p.hand.push(tile);
    s.lastDraw = tile;
    s.lastDrawFromGang = this.drawingForGang;
    this.drawingForGang = false;
    s.wallCount = this.wall.length;
    s.canZimo = handCanWin(p.hand);
    s.phase = 'playing';
    s.message = '';
    this.emit();
    return true;
  }

  discard(playerIdx: number, tileId: number) {
    const s = this.state;
    if (s.phase !== 'playing' || s.currentPlayer !== playerIdx) throw new Error('还没轮到你出牌');
    const p = s.players[playerIdx];
    const idx = p.hand.findIndex((t) => t.id === tileId);
    if (idx < 0) throw new Error('该牌不在手牌中');
    const [tile] = p.hand.splice(idx, 1);
    p.discards.push(tile);
    s.lastDiscard = { tile, player: playerIdx };
    s.canZimo = false;
    s.lastDraw = null;
    const claims = this.computeClaims(tile, playerIdx);
    if (claims.length === 0) {
      this.advanceTurn();
    } else {
      s.phase = 'claim';
      s.claims = claims;
      s.claimResponses = {};
      s.message = '等待玩家响应…';
    }
    this.emit();
  }

  private advanceTurn() {
    const s = this.state;
    s.claims = [];
    s.claimResponses = {};
    s.currentPlayer = (s.currentPlayer + 1) % s.players.length;
    this.drawForCurrent();
  }

  /** 计算其他玩家对这张弃牌可做的全部操作 */
  private computeClaims(tile: Tile, fromPlayer: number): Claim[] {
    const s = this.state;
    const n = s.players.length;
    const claims: Claim[] = [];
    for (let p = 0; p < n; p++) {
      if (p === fromPlayer) continue;
      const player = s.players[p];
      if (canHuWithTile(player.hand, tile)) {
        claims.push({ player: p, type: 'hu', tiles: [] });
      }
      const same = player.hand.filter((t) => sameTile(t, tile));
      if (same.length >= 3) {
        claims.push({ player: p, type: 'gang', tiles: same.slice(0, 3) });
      } else if (same.length === 2) {
        claims.push({ player: p, type: 'peng', tiles: same });
      }
      // 吃只能由下家进行
      if (p === (fromPlayer + 1) % n) {
        const options = this.getChiOptions(player.hand, tile);
        if (options.length > 0) {
          claims.push({ player: p, type: 'chi', tiles: [], options });
        }
      }
    }
    return claims;
  }

  private getChiOptions(hand: Tile[], tile: Tile): Tile[][] {
    if (tile.suit === 'hongzhong') return [];
    const t = tileType(tile);
    const rank = t % 9;
    const base = t - rank;
    const byType = new Map<number, Tile[]>();
    for (const h of hand) {
      const ht = tileType(h);
      if (ht >= base && ht <= base + 8) {
        const arr = byType.get(ht) ?? [];
        arr.push(h);
        byType.set(ht, arr);
      }
    }
    const take = (r: number): Tile | null => {
      const arr = byType.get(base + r);
      return arr && arr.length > 0 ? arr[0] : null;
    };
    const options: Tile[][] = [];
    const mk = (a: Tile | null, b: Tile | null): Tile[] | null => (a && b ? [a, b] : null);
    if (rank <= 6) {
      const o = mk(take(rank + 1), take(rank + 2));
      if (o) options.push(o);
    }
    if (rank >= 1 && rank <= 7) {
      const o = mk(take(rank - 1), take(rank + 1));
      if (o) options.push(o);
    }
    if (rank >= 2) {
      const o = mk(take(rank - 2), take(rank - 1));
      if (o) options.push(o);
    }
    return options;
  }

  /** 响应吃/碰/杠/胡/过。所有有资格响应的玩家都响应后自动结算。 */
  respondClaim(playerIdx: number, action: ClaimAction, optionTiles?: Tile[]) {
    const s = this.state;
    if (s.phase !== 'claim') return;
    if (!s.claims.some((c) => c.player === playerIdx)) return;
    if (action === 'pass') {
      s.claimResponses[playerIdx] = { action: 'pass' };
    } else {
      const claim = s.claims.find((c) => c.player === playerIdx && c.type === action);
      if (!claim) return;
      if (action === 'chi') {
        if (!optionTiles || optionTiles.length !== 2) return;
        const valid = (claim.options ?? []).some(
          (opt) => opt[0].id === optionTiles[0].id && opt[1].id === optionTiles[1].id
        );
        if (!valid) return;
        claim.tiles = optionTiles;
      }
      s.claimResponses[playerIdx] = { action, tiles: claim.tiles };
    }
    this.emit();
    const responders = new Set(s.claims.map((c) => c.player));
    const allResponded = [...responders].every((p) => s.claimResponses[p]);
    if (allResponded) this.resolveClaims();
  }

  private resolveClaims() {
    const s = this.state;
    const resp = s.claimResponses;
    // 胡优先（允许一炮多响）
    const huClaims = s.claims.filter((c) => c.type === 'hu' && resp[c.player]?.action === 'hu');
    if (huClaims.length > 0) {
      const qianggang = !!s.pendingJiagang;
      const tile = s.lastDiscard?.tile ?? s.pendingJiagang?.tile ?? null;
      this.endRound(
        huClaims.map((c) => c.player),
        { zimo: false, tile, qianggang }
      );
      return;
    }
    // 碰 / 杠（按座序从下家开始）
    const from = s.lastDiscard?.player ?? s.pendingJiagang?.player ?? 0;
    const n = s.players.length;
    const gp = s.claims
      .filter((c) => (c.type === 'gang' || c.type === 'peng') && resp[c.player]?.action === c.type)
      .sort((a, b) => ((a.player - from + n) % n) - ((b.player - from + n) % n));
    if (gp.length > 0) {
      this.applyMeld(gp[0]);
      return;
    }
    // 吃
    const chi = s.claims.find((c) => c.type === 'chi' && resp[c.player]?.action === 'chi');
    if (chi) {
      this.applyMeld(chi);
      return;
    }
    // 全部过
    if (s.pendingJiagang) {
      const pj = s.pendingJiagang;
      s.pendingJiagang = null;
      this.completeJiagang(pj.player, pj.tile, pj.meld);
      return;
    }
    this.advanceTurn();
  }

  private applyMeld(claim: Claim) {
    const s = this.state;
    const p = s.players[claim.player];
    const from = s.lastDiscard!.player;
    // 从打牌者弃牌堆移除被吃的牌
    s.players[from].discards.pop();
    const usedIds = new Set(claim.tiles.map((t) => t.id));
    p.hand = p.hand.filter((t) => !usedIds.has(t.id));
    const meld: Meld = {
      type: claim.type === 'gang' ? 'minggang' : claim.type === 'peng' ? 'peng' : 'chi',
      tiles: [...claim.tiles, s.lastDiscard!.tile],
      from,
    };
    p.melds.push(meld);
    s.lastDiscard = null;
    s.claims = [];
    s.claimResponses = {};
    s.currentPlayer = claim.player;
    if (claim.type === 'gang') {
      this.drawingForGang = true;
      this.drawForCurrent(); // 杠后补牌
    } else {
      s.phase = 'playing';
      s.canZimo = false;
      s.message = `${p.name} ${claim.type === 'chi' ? '吃' : '碰'}了 ${meld.tiles[meld.tiles.length - 1].suit === 'hongzhong' ? '红中' : ''}`;
    }
    this.emit();
  }

  /** 自摸胡 */
  zimoHu(playerIdx: number) {
    const s = this.state;
    if (s.phase !== 'playing' || s.currentPlayer !== playerIdx || !s.canZimo) return;
    this.endRound([playerIdx], {
      zimo: true,
      tile: s.lastDraw,
      gangshanghua: s.lastDrawFromGang,
    });
  }

  /** 暗杠：手牌中 4 张相同 */
  angang(playerIdx: number, tileId: number) {
    const s = this.state;
    if (s.phase !== 'playing' || s.currentPlayer !== playerIdx) return;
    const p = s.players[playerIdx];
    const tile = p.hand.find((t) => t.id === tileId);
    if (!tile) return;
    const sameTiles = p.hand.filter((t) => sameTile(t, tile));
    if (sameTiles.length < 4) return;
    const used = sameTiles.slice(0, 4);
    const usedIds = new Set(used.map((t) => t.id));
    p.hand = p.hand.filter((t) => !usedIds.has(t.id));
    p.melds.push({ type: 'angang', tiles: used, from: playerIdx });
    s.canZimo = false;
    this.drawingForGang = true;
    this.drawForCurrent();
    this.emit();
  }

  /** 补杠：手牌中的牌与已有碰组成第 4 张；其他玩家可抢杠胡 */
  jiagang(playerIdx: number, tileId: number) {
    const s = this.state;
    if (s.phase !== 'playing' || s.currentPlayer !== playerIdx) return;
    const p = s.players[playerIdx];
    const tile = p.hand.find((t) => t.id === tileId);
    if (!tile) return;
    const meld = p.melds.find((m) => m.type === 'peng' && sameTile(m.tiles[0], tile));
    if (!meld) return;
    const huPlayers: number[] = [];
    for (let i = 0; i < s.players.length; i++) {
      if (i !== playerIdx && canHuWithTile(s.players[i].hand, tile)) huPlayers.push(i);
    }
    if (huPlayers.length > 0) {
      s.phase = 'claim';
      s.claims = huPlayers.map((i) => ({ player: i, type: 'hu' as const, tiles: [] }));
      s.claimResponses = {};
      s.pendingJiagang = { player: playerIdx, tile, meld };
      s.message = '抢杠！等待玩家响应…';
      this.emit();
      return;
    }
    this.completeJiagang(playerIdx, tile, meld);
  }

  private completeJiagang(playerIdx: number, tile: Tile, meld: Meld) {
    const s = this.state;
    const p = s.players[playerIdx];
    p.hand = p.hand.filter((t) => t.id !== tile.id);
    meld.type = 'jiagang';
    meld.tiles.push(tile);
    s.canZimo = false;
    this.drawingForGang = true;
    this.drawForCurrent();
    this.emit();
  }

  private endRound(
    winners: number[],
    info: { zimo: boolean; tile: Tile | null; qianggang?: boolean; gangshanghua?: boolean; reason?: string }
  ) {
    const s = this.state;
    s.phase = 'roundEnd';
    s.claims = [];
    s.claimResponses = {};
    s.canZimo = false;
    s.winners = winners;
    if (winners.length === 0) {
      s.winInfo = null;
      s.message = info.reason ?? '流局';
      this.emit();
      return;
    }
    const from = info.zimo ? null : s.lastDiscard?.player ?? s.pendingJiagang?.player ?? null;
    s.winInfo = winners.map((w) => {
      const p = s.players[w];
      const detail = calcWinDetail(p.hand, p.melds, info.tile);
      let points = 1 + detail.hongzhongCount;
      const fan = [...detail.fan];
      if (info.zimo) {
        points += 1;
        fan.push('自摸');
      }
      if (info.gangshanghua) {
        points += 1;
        fan.push('杠上开花');
      }
      if (info.qianggang) {
        points += 1;
        fan.push('抢杠');
      }
      if (detail.qidui) points *= 2;
      if (detail.duiduihu) points *= 2;
      if (detail.qingyise) points *= 2;
      if (info.zimo) {
        for (let i = 0; i < s.players.length; i++) {
          if (i !== w) {
            s.players[i].score -= points;
            s.players[w].score += points;
          }
        }
      } else if (from !== null) {
        s.players[from].score -= points;
        s.players[w].score += points;
      }
      const winInfo: WinInfo = {
        winner: w,
        from,
        tile: info.tile,
        zimo: info.zimo,
        qianggang: !!info.qianggang,
        gangshanghua: !!info.gangshanghua,
        qidui: detail.qidui,
        duiduihu: detail.duiduihu,
        qingyise: detail.qingyise,
        hongzhongCount: detail.hongzhongCount,
        points,
        fan,
      };
      return winInfo;
    });
    const names = winners.map((w) => s.players[w].name).join('、');
    s.message = `${names} 胡牌！`;
    s.pendingJiagang = null;
    this.emit();
  }
}
