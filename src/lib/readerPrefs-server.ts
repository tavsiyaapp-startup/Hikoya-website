import "server-only";
import { cookies } from "next/headers";
import {
  READER_FONT_COOKIE,
  READER_SIZE_COOKIE,
  READER_THEME_COOKIE,
  defaultReaderFont,
  defaultReaderFontSize,
  defaultReaderTheme,
  isReaderFont,
  isReaderFontSize,
  isReaderTheme,
  type ReaderFont,
  type ReaderFontSize,
  type ReaderTheme,
} from "./readerPrefs";

export interface ReaderPrefs {
  font: ReaderFont;
  fontSize: ReaderFontSize;
  theme: ReaderTheme;
}

export async function getServerReaderPrefs(): Promise<ReaderPrefs> {
  const store = await cookies();
  const font = store.get(READER_FONT_COOKIE)?.value;
  const fontSize = store.get(READER_SIZE_COOKIE)?.value;
  const theme = store.get(READER_THEME_COOKIE)?.value;
  return {
    font: isReaderFont(font) ? font : defaultReaderFont,
    fontSize: isReaderFontSize(fontSize) ? fontSize : defaultReaderFontSize,
    theme: isReaderTheme(theme) ? theme : defaultReaderTheme,
  };
}
