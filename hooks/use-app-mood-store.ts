import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DefaultAppMood,
  setRuntimeAppMood,
  type AppMoodSettings,
  type IconStyle,
  type ThemeMoodId,
} from '@/constants/theme';

type AppMoodState = AppMoodSettings & {
  setThemeColor: (themeColor: ThemeMoodId) => void;
  setNightMode: (nightMode: boolean) => void;
  setIconStyle: (iconStyle: IconStyle) => void;
  resetMood: () => void;
};

export const useAppMoodStore = create<AppMoodState>()(
  persist(
    (set) => ({
      ...DefaultAppMood,
      setThemeColor: (themeColor) => {
        setRuntimeAppMood({ themeColor });
        set({ themeColor });
      },
      setNightMode: (nightMode) => {
        setRuntimeAppMood({ nightMode });
        set({ nightMode });
      },
      setIconStyle: (iconStyle) => {
        setRuntimeAppMood({ iconStyle });
        set({ iconStyle });
      },
      resetMood: () => {
        setRuntimeAppMood(DefaultAppMood);
        set(DefaultAppMood);
      },
    }),
    {
      name: 'app-mood-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ themeColor, nightMode, iconStyle }) => ({
        themeColor,
        nightMode,
        iconStyle,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setRuntimeAppMood({
          themeColor: state.themeColor,
          nightMode: state.nightMode,
          iconStyle: state.iconStyle,
        });
      },
    }
  )
);
