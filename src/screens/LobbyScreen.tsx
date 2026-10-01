import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { GameRoom } from '../network/room';
import { LobbyState } from '../network/protocol';

interface Props {
  room: GameRoom;
  onLeave: () => void;
}

export default function LobbyScreen({ room, onLeave }: Props) {
  const [lobby, setLobby] = useState<LobbyState | null>(room.latestLobby);
  const [aiCount, setAiCount] = useState(room.latestLobby?.aiCount ?? 3);

  useEffect(() => {
    room.onLobby = (l) => {
      setLobby(l);
      setAiCount(l.aiCount);
    };
    return () => {
      room.onLobby = null;
    };
  }, [room]);

  if (!lobby) {
    return (
      <View style={s.container}>
        <Text style={s.text}>正在进入房间…</Text>
      </View>
    );
  }

  const humans = lobby.players.filter((p) => !p.isAI).length;
  const total = humans + aiCount;
  const canStart = total >= 2 && total <= 4;
  const isHost = lobby.myPlayerId === lobby.hostId;

  return (
    <View style={s.container}>
      <Text style={s.title}>游戏大厅</Text>
      <Text style={s.text}>
        已加入 {humans} 人{total < 4 ? `，还可加入 ${4 - humans} 人` : '（已满）'}
      </Text>

      <FlatList
        style={s.list}
        data={lobby.players}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={s.playerItem}>
            <Text style={s.playerName}>
              {item.name}
              {item.id === lobby.hostId ? '（房主）' : ''}
              {item.isAI ? '（电脑）' : ''}
            </Text>
          </View>
        )}
      />

      {isHost ? (
        <>
          <Text style={s.sectionTitle}>电脑人数（当前 {aiCount} 个，共 {total} 人局）</Text>
          <View style={s.row}>
            {[0, 1, 2, 3].map((n) => {
              const disabled = humans + n < 2 || humans + n > 4;
              return (
                <TouchableOpacity
                  key={n}
                  disabled={disabled}
                  style={[s.numBtn, aiCount === n && s.numBtnActive, disabled && s.numBtnDisabled]}
                  onPress={() => setAiCount(n)}
                >
                  <Text style={[s.numBtnText, aiCount === n && s.numBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[s.btn, !canStart && s.btnDisabled]}
            disabled={!canStart}
            onPress={() => room.startGame(aiCount)}
          >
            <Text style={s.btnText}>开始游戏</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={s.waiting}>等待房主开始游戏…</Text>
      )}

      <TouchableOpacity
        style={s.leaveBtn}
        onPress={() => {
          room.destroy();
          onLeave();
        }}
      >
        <Text style={s.leaveText}>离开房间</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f5f0' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#b71c1c', textAlign: 'center', marginBottom: 8 },
  text: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 12 },
  list: { flex: 1, marginBottom: 12 },
  playerItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  playerName: { fontSize: 16 },
  sectionTitle: { fontSize: 14, color: '#333', marginBottom: 8, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  numBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    backgroundColor: '#fff',
  },
  numBtnActive: { backgroundColor: '#b71c1c', borderColor: '#b71c1c' },
  numBtnDisabled: { opacity: 0.3 },
  numBtnText: { fontSize: 18, fontWeight: 'bold' },
  numBtnTextActive: { color: '#fff' },
  btn: { backgroundColor: '#2e7d32', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#999' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  waiting: { textAlign: 'center', color: '#777', fontSize: 15, marginBottom: 12 },
  leaveBtn: { alignItems: 'center', padding: 10 },
  leaveText: { color: '#999' },
});
