// Client-side reference formatting utilities (no database access)

export type ReferenceFormat = 'human' | 'usfm' | 'mnemonic' | 'text';

export function detectReferenceFormat(query: string): ReferenceFormat {
  const trimmed = query.trim();

  // Mnemonic: exactly 14 digits
  if (/^\d{14}$/.test(trimmed)) {
    return 'mnemonic';
  }

  // USFM: optional digit + 2-3 uppercase letters + space + digits:digits (e.g., JHN 3:16, 1CH 1:1, 2CO 3:16)
  if (/^[0-9]?[A-Z]{2,3}\s+\d+:\d+$/i.test(trimmed)) {
    return 'usfm';
  }

  // Human-readable: Word(s) + space + digits:digits (e.g., John 3:16, 1 John 3:16)
  if (/^[a-zA-Z\d\s]+\s+\d+:\d+$/.test(trimmed)) {
    return 'human';
  }

  return 'text';
}

const USFM_TO_BOOK_NAME: Record<string, string> = {
  GEN: 'Genesis',
  EXO: 'Exodus',
  LEV: 'Leviticus',
  NUM: 'Numbers',
  DEU: 'Deuteronomy',
  JOS: 'Joshua',
  JDG: 'Judges',
  RUT: 'Ruth',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Kings',
  '2KI': '2 Kings',
  '1CH': '1 Chronicles',
  '2CH': '2 Chronicles',
  EZR: 'Ezra',
  NEH: 'Nehemiah',
  EST: 'Esther',
  JOB: 'Job',
  PSA: 'Psalms',
  PRO: 'Proverbs',
  ECC: 'Ecclesiastes',
  SNG: 'Song of Songs',
  ISA: 'Isaiah',
  JER: 'Jeremiah',
  LAM: 'Lamentations',
  EZK: 'Ezekiel',
  DAN: 'Daniel',
  HOS: 'Hosea',
  JOL: 'Joel',
  AMO: 'Amos',
  OBA: 'Obadiah',
  JON: 'Jonah',
  MIC: 'Micah',
  NAM: 'Nahum',
  HAB: 'Habakkuk',
  ZEP: 'Zephaniah',
  HAG: 'Haggai',
  ZEC: 'Zechariah',
  MAL: 'Malachi',
  MAT: 'Matthew',
  MRK: 'Mark',
  LUK: 'Luke',
  JHN: 'John',
  ACT: 'Acts',
  ROM: 'Romans',
  '1CO': '1 Corinthians',
  '2CO': '2 Corinthians',
  GAL: 'Galatians',
  EPH: 'Ephesians',
  PHP: 'Philippians',
  COL: 'Colossians',
  '1TH': '1 Thessalonians',
  '2TH': '2 Thessalonians',
  '1TI': '1 Timothy',
  '2TI': '2 Timothy',
  TIT: 'Titus',
  PHM: 'Philemon',
  HEB: 'Hebrews',
  JAS: 'James',
  '1PE': '1 Peter',
  '2PE': '2 Peter',
  '1JN': '1 John',
  '2JN': '2 John',
  '3JN': '3 John',
  JUD: 'Jude',
  REV: 'Revelation',
};

// USFM code to mnemonic book number (BibleWorks-style)
const USFM_TO_MNEMONIC_BOOK: Record<string, number> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8,
  '1SA': 9, '2SA': 10, '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14,
  EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19, PRO: 20, ECC: 21,
  SNG: 22, ISA: 23, JER: 24, LAM: 25, EZK: 26, DAN: 27, HOS: 28,
  JOL: 29, AMO: 30, OBA: 31, JON: 32, MIC: 33, NAM: 34, HAB: 35,
  ZEP: 36, HAG: 37, ZEC: 38, MAL: 39, MAT: 40, MRK: 41, LUK: 42,
  JHN: 43, ACT: 44, ROM: 45, '1CO': 46, '2CO': 47, GAL: 48, EPH: 49,
  PHP: 50, COL: 51, '1TH': 52, '2TH': 53, '1TI': 54, '2TI': 55, TIT: 56,
  PHM: 57, HEB: 58, JAS: 59, '1PE': 60, '2PE': 61, '1JN': 62, '2JN': 63,
  '3JN': 64, JUD: 65, REV: 66,
};

export function buildReferenceSearchTokens(query: string): string[] {
  const format = detectReferenceFormat(query);
  const tokens = new Set<string>([query]);

  if (format === 'mnemonic') {
    // Parse mnemonic format: 0BBCCCVVVWWWWW
    // 0 = leading zero
    // BB = book + 1 (so 44 = John, which is 43+1)
    // CCC = chapter
    // VVV = verse
    // WWWWW = word range (unused for our purposes)
    const match = query.match(/^0(\d{2})(\d{3})(\d{3})\d{5}$/);
    if (match) {
      const [, bookStr, chapterStr, verseStr] = match;
      const bookNum = parseInt(bookStr, 10) - 1; // Convert back from 1-indexed
      const chapter = parseInt(chapterStr, 10);
      const verse = parseInt(verseStr, 10);

      // Find the USFM code for this book number
      const usfmCode = Object.entries(USFM_TO_MNEMONIC_BOOK).find(
        ([, num]) => num === bookNum
      )?.[0];

      if (usfmCode) {
        const bookName = USFM_TO_BOOK_NAME[usfmCode];
        tokens.add(`${usfmCode} ${chapter}:${verse}`);
        if (bookName) {
          tokens.add(`${bookName} ${chapter}:${verse}`);
        }
      }
    }
  } else if (format === 'usfm') {
    const match = query.match(/^([A-Z0-9]+)\s+(\d+):(\d+)$/i);
    if (match) {
      const [, bookCode, chapter, verse] = match;
      const upperBookCode = bookCode.toUpperCase();
      const bookName = USFM_TO_BOOK_NAME[upperBookCode];
      const bookNum = USFM_TO_MNEMONIC_BOOK[upperBookCode];

      if (bookName) {
        tokens.add(`${bookName} ${chapter}:${verse}`);
      }

      if (bookNum) {
        const mnemonic = '0' +
          String(bookNum + 1).padStart(2, '0') +
          String(chapter).padStart(3, '0') +
          String(verse).padStart(3, '0') +
          String(5).padStart(5, '0');
        tokens.add(mnemonic);
      }
    }
  } else if (format === 'human') {
    const match = query.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (match) {
      const [, bookPart, chapter, verse] = match;
      const usfmEntry = Object.entries(USFM_TO_BOOK_NAME).find(
        ([, name]) => name.toLowerCase() === bookPart.toLowerCase()
      );
      if (usfmEntry) {
        const [usfmCode, bookName] = usfmEntry;
        tokens.add(`${usfmCode} ${chapter}:${verse}`);

        const bookNum = USFM_TO_MNEMONIC_BOOK[usfmCode];
        if (bookNum) {
          const mnemonic = '0' +
            String(bookNum + 1).padStart(2, '0') +
            String(chapter).padStart(3, '0') +
            String(verse).padStart(3, '0') +
            String(5).padStart(5, '0');
          tokens.add(mnemonic);
        }
      }
    }
  }

  return Array.from(tokens);
}
