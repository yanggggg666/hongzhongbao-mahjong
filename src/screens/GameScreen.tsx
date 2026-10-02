import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { GameRoom } from '../network/room';
import { ClientGameState, ClientPlayer } from '../network/protocol';
import { Tile, Claim } from '../game/types';
import { TileView, FaceDownTile } from '../components/TileView';
import { findAngangTiles, findJiagangTiles } from '../game/ai';

interface Props { room: GameRoom; }

const CLAIM_TEXT: Record<string, string> = { hu: '胡', gang: '杠', peng: '碰', chi: '吃' };

export default function GameScreen({ room }: Props) {
  const [state, setState] = useState<ClientGameState | null>(room.latestState);
  const [selected, setSelected] = useState<number | null>(null);
  const [chiOptions, setChiOptions] = useState<Tile[][] | null>(null);

  useEffect(() => {
    room.onState = (st) => { setState(st); setSelected(null); setChiOptions(null); };
    return () => { room.onState = null; };
  }, [room]);

  const me = state?.players.find((p) => p.id === state.myPlayerId);
  const others = state?.players.filter((p) => p.id !== state.myPlayerId) ?? [];
  const isMyTurn = state?.phase === 'playing' && state.currentPlayer === state.myPlayerId;
  const inClaimPhase = state?.phase === 'claim' && state.claims.length > 0;
  const angangTiles = useMemo(() => (isMyTurn && me?.hand ? findAngangTiles(me.hand) : []), [me?.hand, isMyTurn]);
  const jiagangTiles = useMemo(() => (isMyTurn && me?.hand ? findJiagangTiles(me.hand, me.melds) : []), [me?.hand, me?.melds, isMyTurn]);

  if (!state || !me) return <View style={s.container}><Text style={s.text}>等待游戏开始…</Text></View>;

  const onTilePress = (tile: Tile) => {
    if (!isMyTurn) return;
    if (selected === tile.id) room.discard(tile.id);
    else setSelected(tile.id);
  };
  const onClaimPress = (claim: Claim) => {
    if (claim.type === 'chi' && claim.options && claim.options.length > 1) setChiOptions(claim.options);
    else { room.claim(claim.type, claim.options?.[0]); setChiOptions(null); }
  };

  // 布局：上家=others[0], 左家=others[1], 右家=others[2]
  const top = others[0];
  const left = others[1];
  const right = others[2];

  return (
    <View style={s.container}>
      {/* 顶栏 */}
      <View style={s.header}>
        <Text style={s.headerText}>第{state.roundNumber}局</Text>
        <Text style={s.headerText}>余{state.wallCount}</Text>
        <Text style={s.headerText}>{me.score}分</Text>
      </View>

      {/* 上家 */}
      {top && <PlayerArea player={top} position="top" isCurrent={state.currentPlayer === top.id} />}

      {/* 中间：左家 + 中央弃牌区 + 右家 */}
      <View style={s.middleRow}>
        {left && <PlayerArea player={left} position="left" isCurrent={state.currentPlayer === left.id} />}
        <View style={s.centerArea}>
          {state.message ? <Text style={s.messageText}>{state.message}</Text> : null}
          <View style={s.discardPools}>
            {others.map((p) => (
              <View key={p.id} style={s.discardPool}>
                {p.discards.slice(-6).map((t) => <TileView key={t.id} tile={t} size="xs" dimmed />)}
              </View>
            ))}
            <View style={s.discardPool}>
              {me.discards.slice(-6).map((t) => <TileView key={t.id} tile={t} size="xs" dimmed />)}
            </View>
          </View>
        </View>
        {right && <PlayerArea player={right} position="right" isCurrent={state.currentPlayer === right.id} />}
      </View>

      {/* 我的区域 */}
      <View style={s.myArea}>
        <View style={s.myMelds}>
          {me.melds.map((m, i) => (
            <View key={i} style={s.meldGroup}>{m.tiles.map((t) => <TileView key={t.id} tile={t} size="sm" />)}</View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.handRow}>
          {(me.hand ?? []).map((t) => (
            <TileView key={t.id} tile={t} size="lg" selected={selected === t.id}
              highlighted={state.lastDraw?.id === t.id} onPress={isMyTurn ? () => onTilePress(t) : undefined} />
          ))}
        </ScrollView>
      </View>

      {/* 操作按钮 */}
      <View style={s.actionBar}>
        {state.canZimo && isMyTurn && <TouchableOpacity style={[s.actionBtn, s.huBtn]} onPress={() => room.zimoHu()}><Text style={s.actionText}>自摸</Text></TouchableOpacity>}
        {angangTiles.map((t) => <TouchableOpacity key={t.id} style={[s.actionBtn, s.gangBtn]} onPress={() => room.angang(t.id)}><Text style={s.actionText}>暗杠</Text></TouchableOpacity>)}
        {jiagangTiles.map((t) => <TouchableOpacity key={t.id} style={[s.actionBtn, s.gangBtn]} onPress={() => room.jiagang(t.id)}><Text style={s.actionText}>补杠</Text></TouchableOpacity>)}
        {selected !== null && isMyTurn && <TouchableOpacity style={[s.actionBtn, s.discardBtn]} onPress={() => room.discard(selected)}><Text style={s.actionText}>打出</Text></TouchableOpacity>}
        {inClaimPhase && <>
          {state.claims.map((c, i) => <TouchableOpacity key={`${c.type}-${i}`} style={[s.actionBtn, c.type === 'hu' ? s.huBtn : s.claimBtn]} onPress={() => onClaimPress(c)}><Text style={s.actionText}>{CLAIM_TEXT[c.type]}</Text></TouchableOpacity>)}
          <TouchableOpacity style={[s.actionBtn, s.passBtn]} onPress={() => room.claim('pass')}><Text style={s.actionText}>过</Text></TouchableOpacity>
        </>}
      </View>

      {/* 吃牌选择 */}
      <Modal visible={!!chiOptions} transparent animationType="fade">
        <View style={s.modalMask}><View style={s.modalBox}>
          <Text style={s.modalTitle}>选择吃牌组合：</Text>
          <View style={s.row}>{chiOptions?.map((opt, i) => (
            <TouchableOpacity key={i} style={s.chiOption} onPress={() => { room.claim('chi', opt); setChiOptions(null); }}>
              {opt.map((t) => <TileView key={t.id} tile={t} size="sm" />)}
            </TouchableOpacity>
          ))}</View>
          <TouchableOpacity style={s.modalCancel} onPress={() => setChiOptions(null)}><Text style={s.modalCancelText}>取消</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* 结算弹窗 */}
      <Modal visible={state.phase === 'roundEnd'} transparent animationType="fade">
        <View style={s.modalMask}><View style={s.modalBox}>
          {state.winInfo && state.winInfo.length > 0 ? <>
            <Text style={s.modalTitle}>{state.winInfo.map((w) => state.players[w.winner].name).join('、')} 胡牌！</Text>
            {state.winInfo.map((w, i) => (
              <View key={i} style={s.winDetail}>
                <Text style={s.winFan}>{w.fan.join('、') || '平胡'}</Text>
                <Text style={s.winPoints}>{w.zimo ? '自摸' : `点炮（${state.players[w.from ?? 0].name}）`} +{w.points} 分</Text>
              </View>
            ))}
          </> : <Text style={s.modalTitle}>{state.message || '流局'}</Text>}
          <View style={s.scoreRow}>{state.players.map((p) => (
            <Text key={p.id} style={s.scoreText}>{p.name} {p.score > 0 ? `+${p.score}` : p.score}</Text>
          ))}</View>
          {state.amHost
            ? <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={() => room.nextRound()}><Text style={s.btnText}>下一局</Text></TouchableOpacity>
            : <Text style={s.waiting}>等待房主开始下一局…</Text>}
        </View></View>
      </Modal>
    </View>
  );
}

function PlayerArea({ player, position, isCurrent }: { player: ClientPlayer; position: 'top' | 'left' | 'right'; isCurrent: boolean }) {
  const isVertical = position === 'left' || position === 'right';
  return (
    <View style={[s.playerArea, isVertical ? s.playerAreaVertical : s.playerAreaHorizontal, isCurrent && s.playerAreaActive]}>
      <View style={s.playerHeader}>
        <Text style={s.playerName}>{player.name}{player.isAI ? '（电脑）' : ''}</Text>
        <Text style={s.playerScore}>{player.score}分</Text>
      </View>
      <View style={s.handCountRow}>
        {Array.from({ length: player.handCount }).map((_, i) => <FaceDownTile key={i} size="xs" />)}
      </View>
      <View style={s.meldRow}>
        {player.melds.map((m, i) => (
          <View key={i} style={s.meldGroup}>{m.tiles.map((t) => <TileView key={t.id} tile={t} size="xs" />)}</View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1b5e20' },
  text: { color: '#fff', textAlign: 'center', marginTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#1b5e20' },
  headerText: { color: '#fff', fontSize: 12 },
  middleRow: { flex: 1, flexDirection: 'row' },
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2e7d32', margin: 4, borderRadius: 8 },
  messageText: { color: '#ffd54f', fontSize: 12, marginBottom: 4 },
  discardPools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  discardPool: { flexDirection: 'row', flexWrap: 'wrap', margin: 4, maxWidth: 120 },
  playerArea: { backgroundColor: '#f5f5f0', borderRadius: 6, padding: 4, margin: 2 },
  playerAreaHorizontal: { width: '30%' },
  playerAreaVertical: { width: '18%', maxHeight: 120 },
  playerAreaActive: { borderWidth: 2, borderColor: '#ffd54f' },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  playerName: { fontSize: 11, fontWeight: 'bold' },
  playerScore: { fontSize: 10, color: '#777' },
  handCountRow: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 2 },
  meldRow: { flexDirection: 'row', flexWrap: 'wrap' },
  meldGroup: { flexDirection: 'row', marginRight: 2, backgroundColor: '#e0e0e0', borderRadius: 2, padding: 1 },
  myArea: { backgroundColor: '#f5f5f0', paddingHorizontal: 6, paddingVertical: 2 },
  myMelds: { flexDirection: 'row', flexWrap: 'wrap', minHeight: 30, alignItems: 'center' },
  handRow: { maxHeight: 56 },
  actionBar: { flexDirection: 'row', justifyContent: 'center', backgroundColor: '#2e7d32', paddingVertical: 4, minHeight: 40, alignItems: 'center' },
  actionBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 2 },
  huBtn: { backgroundColor: '#d32f2f' },
  gangBtn: { backgroundColor: '#6a1b9a' },
  claimBtn: { backgroundColor: '#ef6c00' },
  passBtn: { backgroundColor: '#757575' },
  discardBtn: { backgroundColor: '#0277bd' },
  actionText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
  chiOption: { flexDirection: 'row', backgroundColor: '#e3f2fd', borderRadius: 6, padding: 4, marginHorizontal: 4 },
  modalCancel: { marginTop: 8, padding: 8 },
  modalCancelText: { color: '#777' },
  winDetail: { marginBottom: 8, alignItems: 'center' },
  winFan: { fontSize: 15, color: '#b71c1c', fontWeight: 'bold' },
  winPoints: { fontSize: 13, color: '#555' },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 10 },
  scoreText: { fontSize: 13, marginHorizontal: 8 },
  btn: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  btnPrimary: { backgroundColor: '#b71c1c' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  waiting: { color: '#777', marginTop: 10, fontSize: 13 },
});
