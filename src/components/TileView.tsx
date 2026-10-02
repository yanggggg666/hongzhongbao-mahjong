import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Tile } from '../game/types';
import { tileLabel } from '../game/tiles';

const SUIT_COLOR: Record<string, string> = {
  wan: '#c62828',
  tiao: '#2e7d32',
  tong: '#1565c0',
  feng: '#212121',
  jian: '#6a1b9a',
  hongzhong: '#b71c1c',
};

interface Props {
  tile: Tile;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
  dimmed?: boolean;
}

export function TileView({ tile, size = 'md', selected, highlighted, onPress, dimmed }: Props) {
  const dims = {
    xs: { w: 18, h: 26, fs: 9 },
    sm: { w: 24, h: 34, fs: 12 },
    md: { w: 34, h: 48, fs: 17 },
    lg: { w: 42, h: 58, fs: 21 },
  }[size];

  const color = SUIT_COLOR[tile.suit];
  const isRed = tile.suit === 'hongzhong';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.5 : 1}
      onPress={onPress}
      style={[
        styles.tile,
        {
          width: dims.w,
          height: dims.h,
          backgroundColor: selected ? '#fff9c4' : highlighted ? '#ffe0b2' : dimmed ? '#e0e0e0' : '#ffffff',
          borderColor: selected ? '#f9a825' : highlighted ? '#ef6c00' : '#bdbdbd',
          borderWidth: selected || highlighted ? 2 : 1,
          margin: 1,
          opacity: dimmed ? 0.6 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color, fontSize: dims.fs, fontWeight: isRed ? 'bold' : 'normal' },
        ]}
      >
        {tileLabel(tile)}
      </Text>
    </TouchableOpacity>
  );
}

export function FaceDownTile({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
  const dims = { xs: { w: 12, h: 18 }, sm: { w: 16, h: 24 }, md: { w: 20, h: 30 } }[size];
  return <View style={[styles.tile, styles.faceDown, { width: dims.w, height: dims.h, margin: 1 }]} />;
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
