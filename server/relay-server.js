/**
 * 红中宝麻将 - WebSocket 中继服务器
 * 只负责转发消息，不跑游戏逻辑（房主是权威）
 * 部署：Render / Railway / Fly.io（免费 tier 即可）
 */
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

/** roomCode -> Set<WebSocket> */
const rooms = new Map();

wss.on('connection', (ws) => {
  let roomCode = null;
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        roomCode = msg.roomCode;
        playerId = msg.playerId;

        if (!rooms.has(roomCode)) {
          rooms.set(roomCode, new Set());
        }
        rooms.get(roomCode).add(ws);

        // 通知房间内其他人有新玩家加入
        broadcast(roomCode, { type: 'playerJoined', playerId, name: msg.name }, ws);
        console.log(`[${roomCode}] 玩家 ${msg.name} 加入，当前 ${rooms.get(roomCode).size} 人`);
      } else if (msg.type === 'leave') {
        // 离开房间
      } else {
        // 转发游戏消息给房间内其他玩家
        if (roomCode) {
          broadcast(roomCode, msg, ws);
        }
      }
    } catch (e) {
      // 忽略无效消息
    }
  });

  ws.on('close', () => {
    if (roomCode && rooms.has(roomCode)) {
      rooms.get(roomCode).delete(ws);
      broadcast(roomCode, { type: 'playerLeft', playerId }, ws);
      if (rooms.get(roomCode).size === 0) {
        rooms.delete(roomCode);
        console.log(`[${roomCode}] 房间已空，删除`);
      }
    }
  });

  ws.on('error', () => {});
});

function broadcast(roomCode, msg, exclude) {
  const clients = rooms.get(roomCode);
  if (!clients) return;
  const data = JSON.stringify(msg);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

console.log(`红中宝麻将中继服务器已启动，端口 ${PORT}`);
