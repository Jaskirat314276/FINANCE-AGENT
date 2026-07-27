import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

/** Reflect the theme onto <html> + native chrome. Kept in sync with the
 *  pre-paint script in index.html, which reads the same persisted key. */
function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.remove('light', 'dark');
  el.classList.add(theme);
  el.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#eef2f9' : '#0b1121');
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Source of truth is the class the pre-paint script already applied.
      theme: document.documentElement.classList.contains('light') ? 'light' : 'dark',
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'seeker-theme',
      // Re-assert the persisted choice onto the DOM once rehydrated.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
