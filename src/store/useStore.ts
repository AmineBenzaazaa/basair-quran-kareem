import AsyncStorage from "@react-native-async-storage/async-storage";
const { create } = require("zustand") as typeof import("zustand");
const { createJSONStorage, persist } = require("zustand/middleware") as typeof import("zustand/middleware");

export type BookmarkType = "article" | "vocab" | "ayah";

export type Bookmark = {
  type: BookmarkType;
  id: string;
  meta?: Record<string, string | number>;
  createdAt: number;
};

export type LastRead = {
  surahId: string;
  ayahNumber: number;
};

type Settings = {
  fontSize: number;
  theme: "light" | "dark";
};

type AppState = {
  bookmarks: Bookmark[];
  lastRead: LastRead | null;
  settings: Settings;
  toggleBookmark: (bookmark: Omit<Bookmark, "createdAt">) => void;
  isBookmarked: (type: BookmarkType, id: string) => boolean;
  setLastRead: (value: LastRead) => void;
  setFontSize: (size: number) => void;
};

import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Default reading font scales with screen: 18px on 390px, floor at 15px
const DEFAULT_FONT_SIZE = Math.max(15, Math.round(18 * Math.min(SCREEN_WIDTH / 390, 1)));

const DEFAULT_SETTINGS: Settings = {
  fontSize: DEFAULT_FONT_SIZE,
  theme: "light",
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      lastRead: null,
      settings: DEFAULT_SETTINGS,
      toggleBookmark: (bookmark) =>
        set((state) => {
          const existing = state.bookmarks.find(
            (item) => item.type === bookmark.type && item.id === bookmark.id
          );
          if (existing) {
            return {
              bookmarks: state.bookmarks.filter(
                (item) => !(item.type === bookmark.type && item.id === bookmark.id)
              ),
            };
          }
          return {
            bookmarks: [
              {
                ...bookmark,
                createdAt: Date.now(),
              },
              ...state.bookmarks,
            ],
          };
        }),
      isBookmarked: (type, id) =>
        Boolean(get().bookmarks.find((item) => item.type === type && item.id === id)),
      setLastRead: (value) => set({ lastRead: value }),
      setFontSize: (size) =>
        set((state) => ({ settings: { ...state.settings, fontSize: size } })),
    }),
    {
      name: "tafsir-app",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
