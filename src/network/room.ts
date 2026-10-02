import TcpSocket from 'react-native-tcp-socket';
import dgram from 'react-native-udp';
import { MahjongEngine } from '../game/engine';
import { aiChooseClaim, aiChooseDiscard } from '../game/ai';
import { sortHand } from '../game/tiles';
import type {
  ClientGameState,
  ClientMessage,
  LobbyState,
  ServerMessage,
} from './protocol';
import type { Tile, Claim } from '../game/types';

const TCP_PORT = 8888;
const UDP_PORT = 9999;
const DISCOVERY_MAGIC = 'HONGZHONGBAO_MAHIJONG_V1';
const MAX_HUMANS = 4;

export interface HostInfo {
  name: string;
  ip: string;
  port: number;
  roomCode?: string;
}

interface ClientConn {
  socket: {
    write: (data: string) => void;
    destroy: () => void;
    on: (event: string, cb: (...args: any[]) => void) => void;
  };
  playerId: number;
  name: string;
  isHost: boolean;
  buffer: string;
}

/**
 * 游戏房间：主机模式（TCP 服务器 + UDP 广播 + 游戏引擎 + AI）
 * 或客户端模式（UDP 发现 + TCP 连接）。
 */
export class GameRoom {
  readonly mode: 'host' | 'client';

  /** 最近一次游戏状态（供 UI 初始化） */
  latestState: ClientGameState | null = null;
  /** 最近一次大厅信息 */
  latestLobby: LobbyState | null = null;
  /** 我的玩家编号 */
  myPlayerId = -1;
  /** 我的名字 */
  myName: string;
  /** 房间号（主机创建房间时生成） */
  roomCode = '';

  onState: ((state: ClientGameState) => void) | null = null;
  onLobby: ((lobby: LobbyState) => void) | null = null;
  onHosts: ((hosts: HostInfo[]) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  private engine: MahjongEngine | null = null;
  private server: any = null;
  private udp: any = null;
  private clientSocket: any = null;
  private ws: WebSocket | null = null;
  private serverUrl = '';
  private clients: ClientConn[] = [];
  private lobbyPlayers: { id: number; name: string; isAI: boolean }[] = [];
  private aiCount = 3;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private destroyed = false;
  private hosts: Map<string, { info: HostInfo; lastSeen: number }> = new Map();
  private buffer = '';

  private constructor(mode: 'host' | 'client', name: string) {
    this.mode = mode;
    this.myName = name;
  }

  /** 创建主机：开启 TCP 服务器与 UDP 广播 */
  static host(name: string): GameRoom {
    const room = new GameRoom('host', name);
    room.myPlayerId = 0;
    room.lobbyPlayers = [{ id: 0, name, isAI: false }];
    room.roomCode = String(Math.floor(1000 + Math.random() * 9000));
    room.startServer();
    return room;
  }

  /** 创建客户端 */
  static client(name: string): GameRoom {
    return new GameRoom('client', name);
  }

  /** 创建互联网主机（通过中继服务器） */
  static internetHost(name: string, serverUrl: string): GameRoom {
    const room = new GameRoom('host', name);
    room.myPlayerId = 0;
    room.lobbyPlayers = [{ id: 0, name, isAI: false }];
    room.roomCode = String(Math.floor(1000 + Math.random() * 9000));
    room.serverUrl = serverUrl;
    room.connectWebSocket();
    return room;
  }

  /** 创建互联网客户端（通过中继服务器） */
  static internetClient(name: string, serverUrl: string, roomCode: string): GameRoom {
    const room = new GameRoom('client', name);
    room.serverUrl = serverUrl;
    room.roomCode = roomCode;
    return room;
  }

  /** 连接到中继服务器 */
  private connectWebSocket() {
    try {
      this.ws = new WebSocket(this.serverUrl);
      this.ws.onopen = () => {
        this.sendWebSocket({
          type: 'join',
          roomCode: this.roomCode,
          playerId: this.myPlayerId,
          name: this.myName,
        });
        if (this.mode === 'host') {
          this.broadcastLobby();
        }
      };
      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          this.handleWebSocketMessage(msg);
        } catch (e) {
          // 忽略无效消息
        }
      };
      this.ws.onerror = () => {
        this.onError?.('无法连接到服务器，请检查网络');
      };
      this.ws.onclose = () => {
        this.onError?.('与服务器断开连接');
      };
    } catch (e) {
      this.onError?.(`连接服务器失败: ${(e as Error).message}`);
    }
  }

  private sendWebSocket(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleWebSocketMessage(msg: any) {
    if (msg.type === 'lobby') {
      this.latestLobby = msg.lobby;
      this.onLobby?.(msg.lobby);
    } else if (msg.type === 'state') {
      this.latestState = msg.state;
      this.onState?.(msg.state);
    } else if (msg.type === 'playerJoined') {
      // 有新玩家加入（主机处理）
      if (this.mode === 'host' && !this.engine) {
        const id = this.nextPlayerId();
        this.lobbyPlayers.push({ id, name: msg.name || `玩家${id}`, isAI: false });
        this.broadcastLobby();
      }
    } else if (msg.type === 'playerLeft') {
      // 有玩家离开
      if (this.mode === 'host' && !this.engine) {
        this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== msg.playerId);
        this.broadcastLobby();
      }
    } else if (this.mode === 'host' && this.engine) {
      // 游戏消息来自客户端
      this.handleClientMessage({ socket: null as any, playerId: msg.playerId, name: '', isHost: false, buffer: '' }, msg);
    }
  }

  /** 互联网客户端加入房间 */
  joinInternet(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendWebSocket({
          type: 'join',
          roomCode: this.roomCode,
          playerId: -1,
          name: this.myName,
        });
        resolve();
      } else {
        reject(new Error('未连接到服务器'));
      }
    });
  }

  // ---------------- 主机 ----------------

  private startServer() {
    this.server = TcpSocket.createServer((socket: any) => {
      const conn: ClientConn = {
        socket,
        playerId: -1,
        name: '',
        isHost: false,
        buffer: '',
      };
      this.clients.push(conn);
      socket.on('data', (data: Buffer) => this.onSocketData(conn, data.toString()));
      socket.on('error', () => {});
      socket.on('close', () => this.onClientClose(conn));
    });
    this.server.on('error', (e: any) => this.onError?.(`服务器错误: ${e.message}`));
    this.server.listen({ port: TCP_PORT, host: '0.0.0.0' }, () => {
      this.broadcastLobby();
      this.startDiscoveryBroadcast();
    });
  }

  /** UDP 广播主机信息，供局域网内其他设备发现 */
  private startDiscoveryBroadcast() {
    try {
      this.udp = dgram.createSocket({ type: 'udp4' });
      this.udp.bind(UDP_PORT + 1);
      const timer = setInterval(() => {
        if (this.destroyed) return;
        try {
          const msg = Buffer.from(
            JSON.stringify({ magic: DISCOVERY_MAGIC, name: this.myName, port: TCP_PORT, roomCode: this.roomCode })
          );
          this.udp.setBroadcast?.(true);
          this.udp.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255');
        } catch (e) {
          // 忽略广播失败
        }
      }, 2000);
      this.timers.push(timer);
    } catch (e) {
      this.onError?.(`UDP 广播启动失败: ${(e as Error).message}`);
    }
  }

  private nextPlayerId(): number {
    let max = 0;
    for (const p of this.lobbyPlayers) max = Math.max(max, p.id);
    for (const c of this.clients) max = Math.max(max, c.playerId);
    return max + 1;
  }

  private handleJoin(conn: ClientConn, name: string) {
    const humans = this.lobbyPlayers.filter((p) => !p.isAI).length;
    if (this.engine) {
      this.send(conn.socket, { type: 'error', message: '游戏已开始，无法加入' });
      return;
    }
    if (humans >= MAX_HUMANS) {
      this.send(conn.socket, { type: 'error', message: '房间已满（最多 4 人）' });
      return;
    }
    const id = this.nextPlayerId();
    conn.playerId = id;
    conn.name = name;
    this.lobbyPlayers.push({ id, name, isAI: false });
    this.send(conn.socket, { type: 'welcome', playerId: id });
    this.broadcastLobby();
  }

  private broadcastLobby() {
    const lobby: LobbyState = {
      players: this.lobbyPlayers,
      aiCount: this.aiCount,
      hostId: 0,
      myPlayerId: -1,
    };
    this.latestLobby = { ...lobby };
    if (this.ws) {
      this.sendWebSocket({ type: 'lobby', lobby: { ...lobby, myPlayerId: this.myPlayerId } });
    }
    for (const c of this.clients) {
      if (c.playerId < 0) continue;
      this.send(c.socket, { type: 'lobby', lobby: { ...lobby, myPlayerId: c.playerId } });
    }
    // 主机本地大厅事件
    this.latestLobby = { ...lobby, myPlayerId: this.myPlayerId };
    this.onLobby?.(this.latestLobby);
  }

  /** 主机开始游戏：已加入人类 + aiCount 个电脑，总人数 2-4 */
  startGame(aiCount: number) {
    if (this.mode !== 'host') return;
    const humans = this.lobbyPlayers.filter((p) => !p.isAI);
    if (humans.length + aiCount < 2 || humans.length + aiCount > MAX_HUMANS) {
      this.onError?.('人数不合法：总人数需在 2-4 人之间');
      return;
    }
    this.aiCount = aiCount;
    const configs = [
      ...humans.map((h) => ({ name: h.name, isAI: false })),
      ...Array.from({ length: aiCount }, (_, i) => ({ name: `电脑${i + 1}`, isAI: true })),
    ];
    this.engine = new MahjongEngine();
    this.engine.onChange = () => this.onEngineChange();
    this.engine.setup(configs);
    this.engine.startRound();
  }

  private onEngineChange() {
    if (!this.engine) return;
    this.broadcastState();
    this.scheduleAI();
  }

  private buildStateFor(playerId: number): ClientGameState {
    const s = this.engine!.state;
    return {
      phase: s.phase,
      players: s.players.map((p, i) => ({
        id: i,
        name: p.name,
        isAI: p.isAI,
        handCount: p.hand.length,
        hand: i === playerId ? sortHand(p.hand) : null,
        melds: p.melds,
        discards: p.discards,
        score: p.score,
      })),
      wallCount: this.engine!.wallSize,
      currentPlayer: s.currentPlayer,
      dealer: s.dealer,
      roundNumber: s.roundNumber,
      lastDiscard: s.lastDiscard,
      lastDraw: playerId === s.currentPlayer ? s.lastDraw : null,
      claims: s.claims.filter((c) => c.player === playerId),
      canZimo: s.currentPlayer === playerId && s.canZimo,
      winners: s.winners,
      winInfo: s.winInfo,
      message: s.message,
      myPlayerId: playerId,
      amHost: playerId === this.myPlayerId,
    };
  }

  private broadcastState() {
    if (this.ws) {
      this.sendWebSocket({ type: 'state', state: this.buildStateFor(this.myPlayerId) });
    }
    for (const c of this.clients) {
      if (c.playerId < 0) continue;
      this.send(c.socket, { type: 'state', state: this.buildStateFor(c.playerId) });
    }
    const local = this.buildStateFor(this.myPlayerId);
    this.latestState = local;
    this.onState?.(local);
  }

  /** 调度 AI 玩家的操作 */
  private scheduleAI() {
    if (!this.engine) return;
    const s = this.engine.state;
    if (s.phase === 'playing' && s.players[s.currentPlayer]?.isAI) {
      const p = s.currentPlayer;
      const timer = setTimeout(() => {
        const st = this.engine?.state;
        if (!st || st.phase !== 'playing' || st.currentPlayer !== p) return;
        const player = st.players[p];
        if (!player?.isAI) return;
        try {
          if (st.canZimo) {
            this.engine!.zimoHu(p);
            return;
          }
          const tileId = aiChooseDiscard(player.hand);
          this.engine!.discard(p, tileId);
        } catch (e) {
          // 忽略非法操作
        }
      }, 800 + Math.random() * 800);
      this.timers.push(timer);
    } else if (s.phase === 'claim') {
      const claimants = new Set(s.claims.map((c) => c.player));
      for (const p of claimants) {
        if (s.claimResponses[p]) continue;
        if (s.players[p]?.isAI) {
          const timer = setTimeout(() => {
            const st = this.engine?.state;
            if (!st || st.phase !== 'claim' || st.claimResponses[p]) return;
            const claim = st.claims.find((c) => c.player === p);
            const player = st.players[p];
            if (!claim || !player) return;
            const decision = aiChooseClaim(player.hand, player.melds, claim);
            try {
              this.engine!.respondClaim(p, decision.action, decision.optionTiles);
            } catch (e) {
              // 忽略非法操作
            }
          }, 600 + Math.random() * 800);
          this.timers.push(timer);
        } else {
          // 人类玩家 15 秒未响应则自动“过”，防止游戏卡死
          const timer = setTimeout(() => {
            const st = this.engine?.state;
            if (!st || st.phase !== 'claim' || st.claimResponses[p]) return;
            try {
              this.engine!.respondClaim(p, 'pass');
            } catch (e) {
              // 忽略非法操作
            }
          }, 15000);
          this.timers.push(timer);
        }
      }
    }
  }

  private onClientClose(conn: ClientConn) {
    this.clients = this.clients.filter((c) => c !== conn);
    if (conn.playerId < 0) return;
    if (this.engine) {
      // 游戏中掉线：转为 AI 继续
      const p = this.engine.state.players[conn.playerId];
      if (p) {
        p.isAI = true;
        p.name = `${p.name}(AI)`;
      }
      this.broadcastState();
      this.scheduleAI();
    } else {
      this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== conn.playerId);
      this.broadcastLobby();
    }
  }

  // ---------------- 客户端 ----------------

  /** 开始监听局域网内的主机广播 */
  startDiscovery() {
    if (this.udp) return;
    try {
      this.udp = dgram.createSocket({ type: 'udp4' });
      this.udp.on('message', (msg: Buffer, rinfo: any) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.magic === DISCOVERY_MAGIC) {
            const key = `${rinfo.address}:${data.port}`;
            this.hosts.set(key, {
              info: { name: data.name, ip: rinfo.address, port: data.port, roomCode: data.roomCode || '' },
              lastSeen: Date.now(),
            });
            this.pushHosts();
          }
        } catch (e) {
          // 忽略无效报文
        }
      });
      this.udp.bind(UDP_PORT);
      const timer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [k, v] of this.hosts) {
          if (now - v.lastSeen > 6000) {
            this.hosts.delete(k);
            changed = true;
          }
        }
        if (changed) this.pushHosts();
      }, 2000);
      this.timers.push(timer);
    } catch (e) {
      this.onError?.(`局域网发现启动失败: ${(e as Error).message}（可尝试手动输入 IP）`);
    }
  }

  private pushHosts() {
    this.onHosts?.(Array.from(this.hosts.values()).map((h) => h.info));
  }

  /** 是否正在监听局域网主机广播 */
  get discovering(): boolean {
    return !!this.udp;
  }

  /** 获取房间号（仅主机模式） */
  getRoomCode(): string {
    return this.roomCode;
  }

  stopDiscovery() {
    if (this.udp) {
      try {
        this.udp.close();
      } catch (e) {
        // ignore
      }
      this.udp = null;
    }
    this.hosts.clear();
  }

  /** 连接到指定 IP 的主机 */
  join(ip: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socket = TcpSocket.createConnection({ port: TCP_PORT, host: ip }, () => {
          this.clientSocket = socket;
          socket.on('data', (data: string | Buffer) => this.onClientData(data.toString()));
          socket.on('error', (e: any) => {
            this.onError?.(`连接失败: ${e.message}`);
            reject(e);
          });
          socket.on('close', () => {
            this.onError?.('与主机断开连接');
            this.clientSocket = null;
          });
          this.send(socket, { type: 'join', name: this.myName });
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private onClientData(data: string) {
    this.buffer += data;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as ServerMessage;
        if (msg.type === 'welcome') {
          this.myPlayerId = msg.playerId;
        } else if (msg.type === 'lobby') {
          this.latestLobby = msg.lobby;
          this.onLobby?.(msg.lobby);
        } else if (msg.type === 'state') {
          this.latestState = msg.state;
          this.onState?.(msg.state);
        } else if (msg.type === 'error') {
          this.onError?.(msg.message);
        }
      } catch (e) {
        // 忽略无效报文
      }
    }
  }

  // ---------------- 通用 ----------------

  private onSocketData(conn: ClientConn, data: string) {
    conn.buffer += data;
    let idx: number;
    while ((idx = conn.buffer.indexOf('\n')) >= 0) {
      const line = conn.buffer.slice(0, idx);
      conn.buffer = conn.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as ClientMessage;
        if (msg.type === 'join') {
          this.handleJoin(conn, msg.name);
        } else if (conn.playerId >= 0) {
          this.handleClientMessage(conn, msg);
        }
      } catch (e) {
        // 忽略无效报文
      }
    }
  }

  private handleClientMessage(conn: ClientConn, msg: ClientMessage) {
    const engine = this.engine;
    if (!engine) return;
    const s = engine.state;
    const pid = conn.playerId;
    try {
      switch (msg.type) {
        case 'discard':
          if (s.phase === 'playing' && s.currentPlayer === pid) engine.discard(pid, msg.tileId);
          break;
        case 'claim':
          if (s.phase === 'claim') engine.respondClaim(pid, msg.action, msg.optionTiles);
          break;
        case 'angang':
          if (s.phase === 'playing' && s.currentPlayer === pid) engine.angang(pid, msg.tileId);
          break;
        case 'jiagang':
          if (s.phase === 'playing' && s.currentPlayer === pid) engine.jiagang(pid, msg.tileId);
          break;
        case 'zimoHu':
          if (s.phase === 'playing' && s.currentPlayer === pid) engine.zimoHu(pid);
          break;
        case 'nextRound':
          if (s.phase === 'roundEnd' && conn.isHost) engine.nextRound();
          break;
      }
    } catch (e) {
      this.onError?.(`操作无效: ${(e as Error).message}`);
    }
  }

  private send(socket: any, msg: ServerMessage | ClientMessage) {
    try {
      socket.write(JSON.stringify(msg) + '\n');
    } catch (e) {
      // 忽略发送失败
    }
  }

  discard(tileId: number) {
    this.safe(() => {
      if (this.mode === 'host' && this.engine) this.engine.discard(this.myPlayerId, tileId);
      else if (this.ws) this.sendWebSocket({ type: 'discard', tileId, playerId: this.myPlayerId });
      else if (this.clientSocket) this.send(this.clientSocket, { type: 'discard', tileId });
    });
  }

  claim(action: 'pass' | 'hu' | 'gang' | 'peng' | 'chi', optionTiles?: Tile[]) {
    this.safe(() => {
      if (this.mode === 'host' && this.engine) {
        this.engine.respondClaim(this.myPlayerId, action, optionTiles);
      } else if (this.ws) {
        this.sendWebSocket({ type: 'claim', action, optionTiles, playerId: this.myPlayerId });
      } else if (this.clientSocket) {
        this.send(this.clientSocket, { type: 'claim', action, optionTiles });
      }
    });
  }

  angang(tileId: number) {
    this.safe(() => {
      if (this.mode === 'host' && this.engine) this.engine.angang(this.myPlayerId, tileId);
      else if (this.ws) this.sendWebSocket({ type: 'angang', tileId, playerId: this.myPlayerId });
      else if (this.clientSocket) this.send(this.clientSocket, { type: 'angang', tileId });
    });
  }

  jiagang(tileId: number) {
    this.safe(() => {
      if (this.mode === 'host' && this.engine) this.engine.jiagang(this.myPlayerId, tileId);
      else if (this.ws) this.sendWebSocket({ type: 'jiagang', tileId, playerId: this.myPlayerId });
      else if (this.clientSocket) this.send(this.clientSocket, { type: 'jiagang', tileId });
    });
  }

  zimoHu() {
    this.safe(() => {
      if (this.mode === 'host' && this.engine) this.engine.zimoHu(this.myPlayerId);
      else if (this.ws) this.sendWebSocket({ type: 'zimoHu', playerId: this.myPlayerId });
      else if (this.clientSocket) this.send(this.clientSocket, { type: 'zimoHu' });
    });
  }

  nextRound() {
    if (this.mode === 'host' && this.engine) {
      this.safe(() => this.engine!.nextRound());
    }
  }

  private safe(fn: () => void) {
    try {
      fn();
    } catch (e) {
      this.onError?.(`操作无效: ${(e as Error).message}`);
    }
  }

  destroy() {
    this.destroyed = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const c of this.clients) {
      try {
        c.socket.destroy();
      } catch (e) {
        // ignore
      }
    }
    this.clients = [];
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
        // ignore
      }
      this.server = null;
    }
    if (this.udp) {
      try {
        this.udp.close();
      } catch (e) {
        // ignore
      }
      this.udp = null;
    }
    if (this.clientSocket) {
      try {
        this.clientSocket.destroy();
      } catch (e) {
        // ignore
      }
      this.clientSocket = null;
    }
    this.engine = null;
  }
}
