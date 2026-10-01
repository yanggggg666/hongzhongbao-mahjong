import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Tile } from '../game/types';
import { tileLabel } from '../game/tiles';

const SUIT_COLOR: Record<string, string> = {
  wan: '#c62828',
  tiao: '#2e7d32',
  tong: '#1565c0',
  hongzhong: '#b71c1c',
};

interface Props {
  tile: Tile;
  size?: 'small' | 'normal' | 'large';
  selected?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
}

export function TileView({ tile, size = 'normal', selected, highlighted, onPress }: Props) {
  const dims =
    size === 'small'
      ? { w: 22, h: 30, fs: 11 }
      : size === 'large'
        ? { w: 44, h: 60, fs: 20 }
        : { w: 32, h: 44, fs: 15 };
  const color = SUIT_COLOR[tile.suit];
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      style={[
        styles.tile,
        {
          width: dims.w,
          height: dims.h,
          backgroundColor: selected ? '#fff9c4' : highlighted ? '#ffe0b2' : '#ffffff',
          borderColor: selected ? '#f9a825' : highlighted ? '#ef6c00' : '#bdbdbd',
          borderWidth: selected || highlighted ? 2 : 1,
          margin: 1,
        },
      ]}
    >
      <Text style={[styles.label, { color, fontSize: dims.fs, fontWeight: tile.suit === 'hongzhong' ? 'bold' : 'normal' }]}>
        {tileLabel(tile)}
      </Text>
    </TouchableOpacity>
  );
}

/** 背面朝上的牌（表示他人手牌数） */
export function FaceDownTile() {
  return <View style={[styles.tile, styles.faceDown, { width: 14, height: 20, margin: 1 }]} />;
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceDown: {
    backgroundColor: '#2e7d32',
    borderColor: '#1b5e20',
  },
  label: {
    textAlign: 'center',
  },
});
