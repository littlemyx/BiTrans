/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#4FC3F7';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    // Additional colors for better theming
    card: '#f8f9fa',
    border: '#e1e5e9',
    primary: '#0a7ea4',
    secondary: '#687076',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    muted: '#6c757d',
    overlay: 'rgba(0, 0, 0, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    // Additional colors for better theming
    card: '#1e1e1e',
    border: '#2d2d2d',
    primary: '#4FC3F7',
    secondary: '#9BA1A6',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    muted: '#6c757d',
    overlay: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
};
