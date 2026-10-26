import "server-only";
import { cookies } from "next/headers";
import {
  READER_FONT_COOKIE,
  READER_SIZE_COOKIE,
  READER_THEME_COOKIE,
  READER_MODE_COOKIE,
  defaultReaderFont,
  defaultReaderFontSize,
  defaultReaderTheme,
  defaultReaderMode,
  isReaderFont,
  isReaderFontSize,
  isReaderTheme,
  isReaderMode,
  type ReaderFont,
  type ReaderFontSize,
  type ReaderTheme,
  type ReaderMode,
} from "./readerPrefs";

export interface ReaderPrefs {
  font: ReaderFont;
  fontSize: ReaderFontSize;
  theme: ReaderTheme;
  mode: ReaderMode;
}

export async function getServerReaderPrefs(): Promise<ReaderPrefs> {
  const store = await cookies();
  const font = store.get(READER_FONT_COOKIE)?.value;
  const fontSize = store.get(READER_SIZE_COOKIE)?.value;
  const theme = store.get(READER_THEME_COOKIE)?.value;
  const mode = store.get(READER_MODE_COOKIE)?.value;
  return {
    font: isReaderFont(font) ? font : defaultReaderFont,
    fontSize: isReaderFontSize(fontSize) ? fontSize : defaultReaderFontSize,
    theme: isReaderTheme(theme) ? theme : defaultReaderTheme,
    mode: isReaderMode(mode) ? mode : defaultReaderMode,
  };
}
