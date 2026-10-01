import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import { GameRoom } from './src/network/room';

type Screen = 'home' | 'lobby' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [error, setError] = useState('');

  const handleRoom = (r: GameRoom) => {
    setRoom(r);
    r.onState = () => setScreen('game');
    r.onError = (m) => setError(m);
    setScreen('lobby');
  };

  const leaveRoom = () => {
    room?.destroy();
    setRoom(null);
    setScreen('home');
  };

  return (
    <SafeAreaView style={s.container}>
      {screen === 'home' && <HomeScreen onRoom={handleRoom} />}
      {screen === 'lobby' && room && <LobbyScreen room={room} onLeave={leaveRoom} />}
      {screen === 'game' && room && <GameScreen room={room} />}
      {error ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{error}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  toast: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 14 },
});
