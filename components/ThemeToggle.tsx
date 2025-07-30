import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/constants/Theme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from './ThemedText';

export function ThemeToggle() {
  const { themeMode, setThemeMode, isSystemTheme } = useTheme();
  const backgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const iconColor = useThemeColor({}, 'icon');

  const getThemeIcon = () => {
    if (isSystemTheme) {
      return 'phone-portrait-outline';
    }
    return themeMode === 'dark' ? 'moon' : 'sunny';
  };

  const getThemeText = () => {
    if (isSystemTheme) {
      return 'System';
    }
    return themeMode === 'dark' ? 'Dark' : 'Light';
  };

  const cycleTheme = () => {
    if (themeMode === 'system') {
      setThemeMode('light');
    } else if (themeMode === 'light') {
      setThemeMode('dark');
    } else {
      setThemeMode('system');
    }
  };

  return (
    <Pressable onPress={cycleTheme} style={[styles.container, { backgroundColor, borderColor }]}>
      <View style={styles.content}>
        <Ionicons name={getThemeIcon() as any} size={20} color={iconColor} />
        <ThemedText style={styles.text}>{getThemeText()}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});