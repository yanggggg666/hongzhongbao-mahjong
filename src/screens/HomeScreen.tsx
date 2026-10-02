import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView } from 'react-native';
import { GameRoom, HostInfo } from '../network/room';

interface Props { onRoom: (room: GameRoom) => void; }

const DEFAULT_SERVER = 'wss://hongzhongbao-relay.onrender.com';

export default function HomeScreen({ onRoom }: Props) {
  const [name, setName] = useState('');
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [manualIp, setManualIp] = useState('');
  const [tab, setTab] = useState<'none' | 'join' | 'internet'>('none');
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [roomCode, setRoomCode] = useState('');
  const clientRef = useRef<GameRoom | null>(null);

  useEffect(() => () => { clientRef.current?.destroy(); }, []);

  const startDiscovery = () => {
    const client = GameRoom.client(name.trim() || '玩家');
    clientRef.current = client;
    client.onHosts = (h) => setHosts(h);
    client.onError = (m) => setError(m);
    client.startDiscovery();
  };

  const join = async (ip: string) => {
    const client = clientRef.current ?? GameRoom.client(name.trim() || '玩家');
    clientRef.current = client;
    client.onHosts = (h) => setHosts(h);
    client.onError = (m) => setError(m);
    if (!client.discovering) client.startDiscovery();
    try { await client.join(ip.trim()); onRoom(client); }
    catch (e) { setError('无法连接到该主机，请确认网络'); }
  };

  const createRoom = () => {
    const room = GameRoom.host(name.trim() || '房主');
    room.onError = (m) => setError(m);
    onRoom(room);
  };

  const createInternetRoom = () => {
    const room = GameRoom.internetHost(name.trim() || '房主', serverUrl.trim() || DEFAULT_SERVER);
    room.onError = (m) => setError(m);
    onRoom(room);
  };

  const joinInternetRoom = async () => {
    if (!roomCode.trim()) { setError('请输入房间号'); return; }
    const client = GameRoom.internetClient(name.trim() || '玩家', serverUrl.trim() || DEFAULT_SERVER, roomCode.trim());
    client.onError = (m) => setError(m);
    try { await client.joinInternet(); onRoom(client); }
    catch (e) { setError('无法连接到服务器，请检查网络和房间号'); }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>红中宝麻将</Text>
      <Text style={s.subtitle}>局域网 / 互联网联机 · 1-4 人 · 可加电脑</Text>

      <TextInput style={s.input} placeholder="输入你的昵称" value={name} onChangeText={setName} maxLength={12} />

      <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={createRoom}>
        <Text style={s.btnText}>创建房间（局域网）</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, s.btnSecondary]} onPress={() => { setTab(tab === 'join' ? 'none' : 'join'); if (tab !== 'join') startDiscovery(); }}>
        <Text style={s.btnText}>加入房间（局域网）</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, s.btnInternet]} onPress={() => setTab(tab === 'internet' ? 'none' : 'internet')}>
        <Text style={s.btnText}>互联网模式</Text>
      </TouchableOpacity>

      {tab === 'join' && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>发现的房间：</Text>
          {hosts.length === 0 && <Text style={s.hint}>正在搜索…</Text>}
          {hosts.map((h) => (
            <TouchableOpacity key={h.ip} style={s.hostItem} onPress={() => join(h.ip)}>
              <Text style={s.hostName}>{h.name} 的房间 {h.roomCode ? `· ${h.roomCode}` : ''}</Text>
              <Text style={s.joinBtn}>加入</Text>
            </TouchableOpacity>
          ))}
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="手动输入主机 IP" value={manualIp} onChangeText={setManualIp} keyboardType="numeric" />
            <TouchableOpacity style={[s.btn, s.btnPrimary, { marginLeft: 8 }]} onPress={() => join(manualIp)}>
              <Text style={s.btnText}>连接</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {tab === 'internet' && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>互联网联机（各自用流量上网）</Text>
          <TextInput style={s.input} placeholder="服务器地址（默认即可）" value={serverUrl} onChangeText={setServerUrl} />
          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={createInternetRoom}>
            <Text style={s.btnText}>创建互联网房间</Text>
          </TouchableOpacity>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="输入房间号" value={roomCode} onChangeText={setRoomCode} keyboardType="numeric" maxLength={4} />
            <TouchableOpacity style={[s.btn, s.btnSecondary, { marginLeft: 8 }]} onPress={joinInternetRoom}>
              <Text style={s.btnText}>加入</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  content: { padding: 16, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#b71c1c' },
  subtitle: { fontSize: 12, color: '#666', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff', marginBottom: 8, width: '100%', maxWidth: 400 },
  btn: { borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8, width: '100%', maxWidth: 400 },
  btnPrimary: { backgroundColor: '#b71c1c' },
  btnSecondary: { backgroundColor: '#2e7d32' },
  btnInternet: { backgroundColor: '#1565c0' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  section: { width: '100%', maxWidth: 400, marginTop: 8 },
  sectionTitle: { fontSize: 13, color: '#333', marginBottom: 4 },
  hint: { color: '#999', fontSize: 12, marginBottom: 4 },
  hostItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: '#ddd' },
  hostName: { fontSize: 14, fontWeight: 'bold' },
  joinBtn: { color: '#2e7d32', fontSize: 14, fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center' },
  error: { color: '#d32f2f', marginTop: 8, textAlign: 'center' },
});
