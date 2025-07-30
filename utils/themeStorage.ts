import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from '@/constants/Theme';

const THEME_STORAGE_KEY = '@theme_mode';

export async function saveThemeMode(themeMode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, themeMode);
  } catch (error) {
    console.error('Error saving theme mode:', error);
  }
}

export async function loadThemeMode(): Promise<ThemeMode | null> {
  try {
    const savedThemeMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return savedThemeMode as ThemeMode | null;
  } catch (error) {
    console.error('Error loading theme mode:', error);
    return null;
  }
}