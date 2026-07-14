import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppSettingsState = {
  smartSorting: boolean;
  setSmartSorting: (smartSorting: boolean) => void;
};

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      smartSorting: true,
      setSmartSorting: (smartSorting) => set({ smartSorting }),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ smartSorting }) => ({ smartSorting }),
    }
  )
);
