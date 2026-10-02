import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
    room.onLobby = (l) => { setLobby(l); setAiCount(l.aiCount); };
    return () => { room.onLobby = null; };
  }, [room]);

  if (!lobby) return <View style={s.container}><Text style={s.text}>正在进入房间…</Text></View>;

  const humans = lobby.players.filter((p) => !p.isAI).length;
  const total = humans + aiCount;
  const canStart = total >= 2 && total <= 4;
  const isHost = lobby.myPlayerId === lobby.hostId;
  const roomCode = room.getRoomCode();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>游戏大厅</Text>
      {isHost && roomCode ? (
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>房间号</Text>
          <Text style={s.codeValue}>{roomCode}</Text>
          <Text style={s.codeHint}>告诉好友此房间号，他们即可加入</Text>
        </View>
      ) : null}

      <Text style={s.info}>已加入 {humans} 人{total < 4 ? `，还可加入 ${4 - humans} 人` : '（已满）'}</Text>

      <View style={s.playerList}>
        {lobby.players.map((p) => (
          <View key={p.id} style={s.playerItem}>
            <Text style={s.playerName}>
              {p.name}{p.id === lobby.hostId ? '（房主）' : ''}{p.isAI ? '（电脑）' : ''}
            </Text>
          </View>
        ))}
      </View>

      {isHost ? (
        <>
          <Text style={s.sectionTitle}>电脑人数（当前 {aiCount} 个，共 {total} 人局）</Text>
          <View style={s.row}>
            {[0, 1, 2, 3].map((n) => {
              const disabled = humans + n < 2 || humans + n > 4;
              return (
                <TouchableOpacity key={n} disabled={disabled}
                  style={[s.numBtn, aiCount === n && s.numBtnActive, disabled && s.numBtnDisabled]}
                  onPress={() => setAiCount(n)}>
                  <Text style={[s.numBtnText, aiCount === n && s.numBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={[s.btn, !canStart && s.btnDisabled]} disabled={!canStart} onPress={() => room.startGame(aiCount)}>
            <Text style={s.btnText}>开始游戏</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={s.waiting}>等待房主开始游戏…</Text>
      )}

      <TouchableOpacity style={s.leaveBtn} onPress={() => { room.destroy(); onLeave(); }}>
        <Text style={s.leaveText}>离开房间</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  content: { padding: 16, alignItems: 'center' },
  text: { color: '#333', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#b71c1c', marginBottom: 8 },
  codeBox: { backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#b71c1c' },
  codeLabel: { fontSize: 12, color: '#666' },
  codeValue: { fontSize: 36, fontWeight: 'bold', color: '#b71c1c', letterSpacing: 8, marginVertical: 2 },
  codeHint: { fontSize: 11, color: '#999' },
  info: { fontSize: 13, color: '#555', marginBottom: 8 },
  playerList: { width: '100%', maxWidth: 400, marginBottom: 8 },
  playerItem: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: '#ddd' },
  playerName: { fontSize: 14 },
  sectionTitle: { fontSize: 13, color: '#333', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  numBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#999', alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, backgroundColor: '#fff' },
  numBtnActive: { backgroundColor: '#b71c1c', borderColor: '#b71c1c' },
  numBtnDisabled: { opacity: 0.3 },
  numBtnText: { fontSize: 16, fontWeight: 'bold' },
  numBtnTextActive: { color: '#fff' },
  btn: { backgroundColor: '#2e7d32', borderRadius: 8, padding: 12, alignItems: 'center', width: '100%', maxWidth: 400 },
  btnDisabled: { backgroundColor: '#999' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  waiting: { color: '#777', fontSize: 14, marginBottom: 8 },
  leaveBtn: { alignItems: 'center', padding: 8, marginTop: 8 },
  leaveText: { color: '#999' },
});
