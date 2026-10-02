import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GameRoom, HostInfo } from '../network/room';

interface Props {
  onRoom: (room: GameRoom) => void;
}

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

  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
    };
  }, []);

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
    try {
      await client.join(ip.trim());
      onRoom(client);
    } catch (e) {
      setError('无法连接到该主机，请确认网络');
    }
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
    if (!roomCode.trim()) {
      setError('请输入房间号');
      return;
    }
    const client = GameRoom.internetClient(name.trim() || '玩家', serverUrl.trim() || DEFAULT_SERVER, roomCode.trim());
    client.onError = (m) => setError(m);
    try {
      await client.joinInternet();
      onRoom(client);
    } catch (e) {
      setError('无法连接到服务器，请检查网络和房间号');
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={s.title}>红中宝麻将</Text>
      <Text style={s.subtitle}>局域网 / 互联网联机 · 1-4 人 · 可加电脑</Text>

      <TextInput
        style={s.input}
        placeholder="输入你的昵称"
        value={name}
        onChangeText={setName}
        maxLength={12}
      />

      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={createRoom}>
          <Text style={s.btnText}>创建房间（局域网）</Text>
        </TouchableOpacity>
      </View>

      <View style={s.row}>
        <TouchableOpacity
          style={[s.btn, s.btnSecondary]}
          onPress={() => {
            setTab(tab === 'join' ? 'none' : 'join');
            if (tab !== 'join') startDiscovery();
          }}
        >
          <Text style={s.btnText}>加入房间（局域网）</Text>
        </TouchableOpacity>
      </View>

      <View style={s.row}>
        <TouchableOpacity
          style={[s.btn, s.btnInternet]}
          onPress={() => setTab(tab === 'internet' ? 'none' : 'internet')}
        >
          <Text style={s.btnText}>互联网模式</Text>
        </TouchableOpacity>
      </View>

      {tab === 'join' && (
        <View style={s.discovery}>
          <Text style={s.sectionTitle}>发现的房间：</Text>
          {hosts.length === 0 && <Text style={s.hint}>正在搜索局域网内的房间…</Text>}
          <FlatList
            data={hosts}
            keyExtractor={(h) => h.ip}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.hostItem} onPress={() => join(item.ip)}>
                <View style={s.hostInfo}>
                  <Text style={s.hostName}>{item.name} 的房间</Text>
                  {item.roomCode ? (
                    <Text style={s.roomCode}>房间号：{item.roomCode}</Text>
                  ) : (
                    <Text style={s.hostIp}>{item.ip}</Text>
                  )}
                </View>
                <Text style={s.joinBtn}>加入</Text>
              </TouchableOpacity>
            )}
          />
          <View style={s.row}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="手动输入主机 IP"
              value={manualIp}
              onChangeText={setManualIp}
              keyboardType="numeric"
            />
            <TouchableOpacity style={[s.btn, s.btnPrimary, { marginLeft: 8 }]} onPress={() => join(manualIp)}>
              <Text style={s.btnText}>连接</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {tab === 'internet' && (
        <View style={s.discovery}>
          <Text style={s.sectionTitle}>互联网联机（各自用流量上网）</Text>
          <TextInput
            style={s.input}
            placeholder="服务器地址（默认即可）"
            value={serverUrl}
            onChangeText={setServerUrl}
          />
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={createInternetRoom}>
              <Text style={s.btnText}>创建互联网房间</Text>
            </TouchableOpacity>
          </View>
          <View style={s.row}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="输入房间号"
              value={roomCode}
              onChangeText={setRoomCode}
              keyboardType="numeric"
              maxLength={4}
            />
            <TouchableOpacity style={[s.btn, s.btnSecondary, { marginLeft: 8 }]} onPress={joinInternetRoom}>
              <Text style={s.btnText}>加入</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.hint}>房主创建房间后会显示房间号，其他人输入房间号即可加入</Text>
        </View>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f5f5f0' },
  title: { fontSize: 34, fontWeight: 'bold', textAlign: 'center', color: '#b71c1c', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', marginBottom: 12 },
  btn: { flex: 1, borderRadius: 8, padding: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#b71c1c' },
  btnSecondary: { backgroundColor: '#2e7d32' },
  btnInternet: { backgroundColor: '#1565c0' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  discovery: { marginTop: 8 },
  sectionTitle: { fontSize: 14, color: '#333', marginBottom: 6 },
  hint: { color: '#999', fontSize: 13, marginBottom: 8 },
  hostItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  hostInfo: { flex: 1 },
  hostName: { fontSize: 15, fontWeight: 'bold' },
  roomCode: { fontSize: 13, color: '#b71c1c', fontWeight: 'bold', marginTop: 2 },
  hostIp: { fontSize: 12, color: '#777', marginTop: 2 },
  joinBtn: { color: '#2e7d32', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  error: { color: '#d32f2f', marginTop: 12, textAlign: 'center' },
});
