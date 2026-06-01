#!/usr/bin/env node
// Scrapes public-domain prose from Project Gutenberg and distills it into
// short, read-aloud-sized passages for the Practice "read provided text" mode.
//
//   node scripts/scrape-passages.mjs            # use cache when present
//   node scripts/scrape-passages.mjs --refresh  # re-download everything
//
// Output: src/lib/readingPassages.generated.js  (committed to the repo).
//
// The *texts* below are public domain (authors long dead, pre-1929 works).
// We strip every Project Gutenberg header/footer/boilerplate so the emitted
// data contains only the underlying public-domain prose, attributed by
// original title + author. Nothing Gutenberg-trademarked survives.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '.cache');
const OUT_FILE = join(__dirname, '..', 'src', 'lib', 'readingPassages.generated.js');
const REFRESH = process.argv.includes('--refresh');

// ---------------------------------------------------------------------------
// The catalog. Each entry is a Gutenberg ebook id with a friendly title,
// author, and the register/genre we file its passages under. Genres double as
// optgroup labels in the passage picker, so keep them human and few.
// Unreachable ids are skipped silently, so the list can be generous.
// ---------------------------------------------------------------------------
const GENRES = {
  literary: 'Literary fiction',
  adventure: 'Adventure',
  mystery: 'Mystery & detective',
  scifi: 'Science fiction & gothic',
  children: "Children's & whimsical",
  nonfiction: 'Essays & non-fiction',
  philosophy: 'Philosophy & ideas',
  oratory: 'Speeches & rhetoric',
  poetry: 'Poetry & verse',
};

const CATALOG = [
  // --- literary fiction ---
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'literary' },
  { id: 158, title: 'Emma', author: 'Jane Austen', genre: 'literary' },
  { id: 161, title: 'Sense and Sensibility', author: 'Jane Austen', genre: 'literary' },
  { id: 1260, title: 'Jane Eyre', author: 'Charlotte Brontë', genre: 'literary' },
  { id: 768, title: 'Wuthering Heights', author: 'Emily Brontë', genre: 'literary' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens', genre: 'literary' },
  { id: 1400, title: 'Great Expectations', author: 'Charles Dickens', genre: 'literary' },
  { id: 730, title: 'Oliver Twist', author: 'Charles Dickens', genre: 'literary' },
  { id: 76, title: 'Adventures of Huckleberry Finn', author: 'Mark Twain', genre: 'literary' },
  { id: 74, title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', genre: 'literary' },
  { id: 2701, title: 'Moby-Dick', author: 'Herman Melville', genre: 'literary' },
  { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', genre: 'literary' },
  { id: 2641, title: 'A Room with a View', author: 'E. M. Forster', genre: 'literary' },
  { id: 1399, title: 'Anna Karenina', author: 'Leo Tolstoy', genre: 'literary' },
  { id: 2600, title: 'War and Peace', author: 'Leo Tolstoy', genre: 'literary' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', genre: 'literary' },
  { id: 2000, title: 'Don Quixote', author: 'Miguel de Cervantes', genre: 'literary' },
  { id: 1023, title: 'Bleak House', author: 'Charles Dickens', genre: 'literary' },
  { id: 145, title: 'Middlemarch', author: 'George Eliot', genre: 'literary' },
  { id: 432, title: 'The Mill on the Floss', author: 'George Eliot', genre: 'literary' },

  // --- adventure ---
  { id: 120, title: 'Treasure Island', author: 'Robert Louis Stevenson', genre: 'adventure' },
  { id: 1184, title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', genre: 'adventure' },
  { id: 1257, title: 'The Three Musketeers', author: 'Alexandre Dumas', genre: 'adventure' },
  { id: 103, title: 'Around the World in Eighty Days', author: 'Jules Verne', genre: 'adventure' },
  { id: 164, title: 'Twenty Thousand Leagues under the Sea', author: 'Jules Verne', genre: 'adventure' },
  { id: 215, title: 'The Call of the Wild', author: 'Jack London', genre: 'adventure' },
  { id: 910, title: 'White Fang', author: 'Jack London', genre: 'adventure' },
  { id: 236, title: 'The Jungle Book', author: 'Rudyard Kipling', genre: 'adventure' },
  { id: 558, title: 'The Lost World', author: 'Arthur Conan Doyle', genre: 'adventure' },

  // --- mystery & detective ---
  { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery' },
  { id: 2852, title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'mystery' },
  { id: 244, title: 'A Study in Scarlet', author: 'Arthur Conan Doyle', genre: 'mystery' },
  { id: 583, title: 'The Moonstone', author: 'Wilkie Collins', genre: 'mystery' },
  { id: 155, title: 'The Woman in White', author: 'Wilkie Collins', genre: 'mystery' },

  // --- science fiction & gothic ---
  { id: 84, title: 'Frankenstein', author: 'Mary Shelley', genre: 'scifi' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker', genre: 'scifi' },
  { id: 43, title: 'The Strange Case of Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson', genre: 'scifi' },
  { id: 35, title: 'The Time Machine', author: 'H. G. Wells', genre: 'scifi' },
  { id: 36, title: 'The War of the Worlds', author: 'H. G. Wells', genre: 'scifi' },
  { id: 5230, title: 'The Invisible Man', author: 'H. G. Wells', genre: 'scifi' },
  { id: 5200, title: 'Metamorphosis', author: 'Franz Kafka', genre: 'scifi' },

  // --- children's & whimsical ---
  { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', genre: 'children' },
  { id: 12, title: 'Through the Looking-Glass', author: 'Lewis Carroll', genre: 'children' },
  { id: 289, title: 'The Wind in the Willows', author: 'Kenneth Grahame', genre: 'children' },
  { id: 113, title: 'The Secret Garden', author: 'Frances Hodgson Burnett', genre: 'children' },
  { id: 514, title: 'Little Women', author: 'Louisa May Alcott', genre: 'children' },
  { id: 271, title: 'Black Beauty', author: 'Anna Sewell', genre: 'children' },
  { id: 16, title: 'Peter Pan', author: 'J. M. Barrie', genre: 'children' },
  { id: 55, title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', genre: 'children' },
  { id: 2591, title: "Grimms' Fairy Tales", author: 'Brothers Grimm', genre: 'children' },

  // --- essays & non-fiction ---
  { id: 205, title: 'Walden', author: 'Henry David Thoreau', genre: 'nonfiction' },
  { id: 16643, title: 'Essays', author: 'Ralph Waldo Emerson', genre: 'nonfiction' },
  { id: 1228, title: 'On the Origin of Species', author: 'Charles Darwin', genre: 'nonfiction' },
  { id: 944, title: 'The Voyage of the Beagle', author: 'Charles Darwin', genre: 'nonfiction' },
  { id: 148, title: 'The Autobiography of Benjamin Franklin', author: 'Benjamin Franklin', genre: 'nonfiction' },
  { id: 408, title: 'The Souls of Black Folk', author: 'W. E. B. Du Bois', genre: 'nonfiction' },

  // --- philosophy & ideas ---
  { id: 2680, title: 'Meditations', author: 'Marcus Aurelius', genre: 'philosophy' },
  { id: 1232, title: 'The Prince', author: 'Niccolò Machiavelli', genre: 'philosophy' },
  { id: 132, title: 'The Art of War', author: 'Sun Tzu', genre: 'philosophy' },
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift', genre: 'philosophy' },
  { id: 3207, title: 'Leviathan', author: 'Thomas Hobbes', genre: 'philosophy' },

  // --- speeches & rhetoric ---
  { id: 147, title: 'Common Sense', author: 'Thomas Paine', genre: 'oratory' },
  { id: 1404, title: 'The Federalist Papers', author: 'Hamilton, Madison & Jay', genre: 'oratory' },
  { id: 815, title: 'The Autobiography of Theodore Roosevelt', author: 'Theodore Roosevelt', genre: 'oratory' },

  // === additional prose (verified ids) ===
  // literary fiction
  { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'literary' },
  { id: 33, title: 'The Scarlet Letter', author: 'Nathaniel Hawthorne', genre: 'literary' },
  { id: 219, title: 'Heart of Darkness', author: 'Joseph Conrad', genre: 'literary' },
  { id: 2814, title: 'Dubliners', author: 'James Joyce', genre: 'literary' },
  { id: 4217, title: 'A Portrait of the Artist as a Young Man', author: 'James Joyce', genre: 'literary' },
  // adventure
  { id: 521, title: 'Robinson Crusoe', author: 'Daniel Defoe', genre: 'adventure' },
  { id: 83, title: 'From the Earth to the Moon', author: 'Jules Verne', genre: 'adventure' },
  { id: 18857, title: 'A Journey to the Centre of the Earth', author: 'Jules Verne', genre: 'adventure' },
  { id: 2166, title: "King Solomon's Mines", author: 'H. Rider Haggard', genre: 'adventure' },
  // mystery & detective
  { id: 863, title: 'The Mysterious Affair at Styles', author: 'Agatha Christie', genre: 'mystery' },
  { id: 2097, title: 'The Sign of the Four', author: 'Arthur Conan Doyle', genre: 'mystery' },
  { id: 834, title: 'The Memoirs of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery' },
  { id: 108, title: 'The Return of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery' },
  // science fiction & gothic
  { id: 159, title: 'The Island of Doctor Moreau', author: 'H. G. Wells', genre: 'scifi' },
  { id: 209, title: 'The Turn of the Screw', author: 'Henry James', genre: 'scifi' },
  { id: 41, title: 'The Legend of Sleepy Hollow', author: 'Washington Irving', genre: 'scifi' },
  // essays & non-fiction
  { id: 23, title: 'Narrative of the Life of Frederick Douglass', author: 'Frederick Douglass', genre: 'nonfiction' },
  { id: 2376, title: 'Up from Slavery', author: 'Booker T. Washington', genre: 'nonfiction' },
  { id: 3300, title: 'The Wealth of Nations', author: 'Adam Smith', genre: 'nonfiction' },
  // philosophy & ideas
  { id: 34901, title: 'On Liberty', author: 'John Stuart Mill', genre: 'philosophy' },
  { id: 5827, title: 'The Problems of Philosophy', author: 'Bertrand Russell', genre: 'philosophy' },

  // === poetry & verse (post-Shakespeare, verified ids) ===
  { id: 1322, title: 'Leaves of Grass', author: 'Walt Whitman', genre: 'poetry', poetry: true },
  { id: 1280, title: 'Spoon River Anthology', author: 'Edgar Lee Masters', genre: 'poetry', poetry: true },
  { id: 19, title: 'The Song of Hiawatha', author: 'Henry Wadsworth Longfellow', genre: 'poetry', poetry: true },
  { id: 1934, title: 'Songs of Innocence and of Experience', author: 'William Blake', genre: 'poetry', poetry: true },
  { id: 574, title: 'Poems of William Blake', author: 'William Blake', genre: 'poetry', poetry: true },
  { id: 12242, title: 'Poems', author: 'Emily Dickinson', genre: 'poetry', poetry: true },
  { id: 10031, title: 'The Complete Poetical Works', author: 'Edgar Allan Poe', genre: 'poetry', poetry: true },
  { id: 23684, title: 'Poems Published in 1820', author: 'John Keats', genre: 'poetry', poetry: true },
  { id: 9622, title: 'Lyrical Ballads', author: 'Wordsworth & Coleridge', genre: 'poetry', poetry: true },
  { id: 9601, title: 'Poetical Works', author: 'Alexander Pope', genre: 'poetry', poetry: true },
  { id: 610, title: 'Idylls of the King', author: 'Alfred, Lord Tennyson', genre: 'poetry', poetry: true },
  { id: 3026, title: 'North of Boston', author: 'Robert Frost', genre: 'poetry', poetry: true },
  { id: 3021, title: "A Boy's Will", author: 'Robert Frost', genre: 'poetry', poetry: true },
  { id: 4800, title: 'The Complete Poetical Works', author: 'Percy Bysshe Shelley', genre: 'poetry', poetry: true },
  { id: 16341, title: 'Poems', author: 'William Cullen Bryant', genre: 'poetry', poetry: true },
];

// A small hand-curated set of canonical public-domain oratory. These are short
// and famous enough that scraping whole books for them is overkill, and they
// are exactly the kind of text a speaking app wants for projection/cadence.
const CURATED = [
  {
    id: 'gb-curated-gettysburg',
    title: 'The Gettysburg Address — Abraham Lincoln',
    author: 'Abraham Lincoln',
    genre: 'oratory',
    text: 'Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battlefield of that war.',
  },
  {
    id: 'gb-curated-lincoln2',
    title: 'Second Inaugural Address — Abraham Lincoln',
    author: 'Abraham Lincoln',
    genre: 'oratory',
    text: 'With malice toward none, with charity for all, with firmness in the right as God gives us to see the right, let us strive on to finish the work we are in, to bind up the nation’s wounds, to care for him who shall have borne the battle and for his widow and his orphan, to do all which may achieve and cherish a just and lasting peace among ourselves and with all nations.',
  },
  {
    id: 'gb-curated-henry',
    title: 'Give Me Liberty — Patrick Henry',
    author: 'Patrick Henry',
    genre: 'oratory',
    text: 'It is in vain, sir, to extenuate the matter. Gentlemen may cry, peace, peace, but there is no peace. The war is actually begun! The next gale that sweeps from the north will bring to our ears the clash of resounding arms! Why stand we here idle? Is life so dear, or peace so sweet, as to be purchased at the price of chains and slavery? Forbid it, Almighty God! I know not what course others may take, but as for me, give me liberty, or give me death!',
  },
  {
    id: 'gb-curated-truth',
    title: "Ain't I a Woman? — Sojourner Truth",
    author: 'Sojourner Truth',
    genre: 'oratory',
    text: 'That man over there says that women need to be helped into carriages, and lifted over ditches, and to have the best place everywhere. Nobody ever helps me into carriages, or over mud-puddles, or gives me any best place. And ain’t I a woman? Look at me! Look at my arm! I have ploughed and planted, and gathered into barns, and no man could head me. And ain’t I a woman?',
  },
];

// ---------------------------------------------------------------------------
// Extraction tuning.
// ---------------------------------------------------------------------------
const MIN_WORDS = 45;
const MAX_WORDS = 110;
const MIN_SENTENCES = 2;
const MAX_SENTENCES = 6;
const PER_BOOK = 7; // prose candidates kept per book, spread across the text
const PER_BOOK_POETRY = 6; // verse stanzas kept per poetry book
const PER_GENRE = 60; // cap per genre, filled round-robin across that genre's books
const GLOBAL_CAP = 800; // overall safety ceiling

// Poetry-specific sizing (stanzas are shorter than prose paragraphs).
const POETRY_MIN_WORDS = 18;
const POETRY_MAX_WORDS = 95;
const POETRY_MIN_LINES = 2;
const POETRY_MAX_LINES = 9;

// Words that, if they open a paragraph, signal it depends on earlier context.
const LEADING_STOPWORDS = new Set([
  'and', 'but', 'or', 'nor', 'so', 'yet', 'for', 'because', 'which', 'that',
  'then', 'thus', 'therefore', 'however', 'moreover', 'besides', 'still',
  'meanwhile', 'nevertheless', 'this', 'these', 'those', 'they', 'he', 'she',
  'it', 'him', 'her', 'them', 'his', 'their', 'its',
]);

// Skip any passage containing an offensive term — users read these aloud, so we
// over-filter rather than surface something ugly. Hard slurs are blocked
// everywhere; the "mild" set (profanity + religious/era words) is blocked in
// prose but allowed in classic poetry, where "God"/"Lord" etc. are pervasive and
// blocking them would gut Blake, Whitman, Dickinson and the hymn-like verse.
const HARD_SLURS = [
  'nigger', 'nigga', 'niggers', 'negroes', 'negro', 'darkies', 'darky', 'darkie',
  'injun', 'injuns', 'redskin', 'redskins', 'half-breed', 'kike', 'chink',
  'chinaman', 'chinamen', 'coolie', 'coolies', 'wop', 'dago', 'spic',
];
const MILD_BLOCK = [
  'savages', 'savage', 'cripple', 'idiot', 'imbecile', 'whore', 'whores',
  'bastard', 'bastards', 'damn', 'damned', 'hell', 'god', 'lord', 'christ',
  'gypsy', 'gypsies',
];
const BLOCK_RE = new RegExp(`\\b(${[...HARD_SLURS, ...MILD_BLOCK].join('|')})\\b`, 'i');
const POETRY_BLOCK_RE = new RegExp(`\\b(${HARD_SLURS.join('|')})\\b`, 'i');

// Characters allowed in a clean read-aloud passage (after normalization).
const ALLOWED_RE = /^[\p{L} \n.,;:!?'"()—–-]+$/u;

async function getRaw(book) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `${book.id}.txt`);
  if (!REFRESH) {
    try {
      const cached = await readFile(cachePath, 'utf8');
      if (cached.length > 1000) return cached;
    } catch {
      /* not cached yet */
    }
  }
  const urls = [
    `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`,
    `https://www.gutenberg.org/files/${book.id}/${book.id}-0.txt`,
    `https://www.gutenberg.org/files/${book.id}/${book.id}.txt`,
    `https://gutenberg.pglaf.org/${String(book.id).split('').join('/')}/${book.id}/${book.id}-0.txt`,
  ];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'SpeechImprover passage builder (one-time, low volume)' },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const txt = await res.text();
      if (txt.length < 1000) continue;
      await writeFile(cachePath, txt, 'utf8');
      await sleep(700); // be polite to the server between real downloads
      return txt;
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

function stripBoilerplate(raw) {
  let t = raw.replace(/\r\n/g, '\n');
  const start = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i);
  if (start !== -1) t = t.slice(t.indexOf('\n', start) + 1);
  const end = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (end !== -1) t = t.slice(0, end);
  // Drop common inline artifacts.
  t = t
    .replace(/\[Illustration[^\]]*\]/gi, '')
    .replace(/\[Footnote[^\]]*\]/gi, '')
    .replace(/_/g, '');
  return t;
}

function normalizeText(s) {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s*--\s*/g, '—') // "--" -> em dash
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceCount(s) {
  const m = s.match(/[.!?]+["')\]]?(\s|$)/g);
  return m ? m.length : 0;
}

function looksLikeVerse(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return false;
  const avg = lines.reduce((a, l) => a + l.length, 0) / lines.length;
  return avg < 48; // many short lines => poem / list / table
}

function acceptable(text, rawBlock) {
  if (looksLikeVerse(rawBlock)) return false;
  if (!ALLOWED_RE.test(text)) return false;
  if (/\d/.test(text)) return false; // numerals read awkwardly aloud
  if (BLOCK_RE.test(text)) return false;
  if (/\b[A-Z]{4,}\b/.test(text)) return false; // headings: CHAPTER, CONTENTS...
  if (/\b\w{18,}\b/.test(text)) return false; // OCR junk / absurd compounds
  if (/^(chapter|book|part|section|canto|act|scene|volume|preface|contents)\b/i.test(text)) return false;
  if (/^[IVXLCDM]+\.\s/.test(text)) return false; // leading section numerals: "III. ..."

  const words = text.split(' ');
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) return false;

  const sent = sentenceCount(text);
  if (sent < MIN_SENTENCES || sent > MAX_SENTENCES) return false;
  if (words.length / sent < 6) return false; // fragment lists / chapter summaries

  const first = text[0];
  if (!/[A-Z"]/.test(first)) return false; // must open like a sentence
  const firstWord = words[0].replace(/[^A-Za-z]/g, '').toLowerCase();
  if (LEADING_STOPWORDS.has(firstWord)) return false;

  if (!/[.!?]["')\]]?$/.test(text)) return false; // must close a sentence

  // Avoid dialogue-dominated fragments (hard to follow standalone).
  const quotes = (text.match(/"/g) || []).length;
  if (quotes >= 4) return false;

  return true;
}

function extractPassages(book, raw) {
  const text = stripBoilerplate(raw);
  const blocks = text.split(/\n\s*\n/);
  const seen = new Set();
  const candidates = [];
  for (const block of blocks) {
    const cleaned = normalizeText(block);
    if (!cleaned) continue;
    if (!acceptable(cleaned, block)) continue;
    const key = cleaned.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(cleaned);
  }
  // Spread the selection across the body, skipping front/back matter.
  const lo = Math.floor(candidates.length * 0.08);
  const hi = Math.ceil(candidates.length * 0.95);
  const body = candidates.slice(lo, hi);
  const picks = [];
  if (body.length) {
    const step = Math.max(1, Math.floor(body.length / PER_BOOK));
    for (let i = 0; i < body.length && picks.length < PER_BOOK; i += step) {
      picks.push(body[i]);
    }
  }
  return picks.map((text, i) => ({
    id: `gb-${book.id}-${i + 1}`,
    title: `${book.title} — ${book.author}`,
    text,
    genre: book.genre,
    author: book.author,
    source: book.title,
  }));
}

// --- poetry path: keep verse line breaks, accept short lines, relax sentence
// rules. Stanzas are split on blank lines; headings / section numbers dropped. ---
function normalizePoetry(block) {
  return block
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s*--\s*/g, '—')
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l && !/^[IVXLCDM]+\.?$/i.test(l) && !/^(canto|book|part|stanza|chapter|section|scene|act)\b/i.test(l))
    .join('\n')
    .trim();
}

function acceptablePoetry(text) {
  if (!ALLOWED_RE.test(text)) return false; // ALLOWED_RE permits newlines
  if (/\d/.test(text)) return false;
  if (POETRY_BLOCK_RE.test(text)) return false;
  const lines = text.split('\n');
  if (lines.length < POETRY_MIN_LINES || lines.length > POETRY_MAX_LINES) return false;
  // reject heading-like all-caps lines (poem titles, "THE TYGER")
  for (const l of lines) {
    if (l.replace(/[^A-Za-z]/g, '').length >= 3 && l === l.toUpperCase()) return false;
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < POETRY_MIN_WORDS || words.length > POETRY_MAX_WORDS) return false;
  // average line length keeps us in verse territory (not a prose paragraph)
  if (text.length / lines.length > 72) return false;
  if ((text.match(/"/g) || []).length >= 4) return false;
  if (!/[a-z]/.test(text)) return false; // not a title block
  if (!/^[A-Za-z"']/.test(text)) return false;
  return true;
}

function extractPoetry(book, raw) {
  const text = stripBoilerplate(raw);
  const blocks = text.split(/\n\s*\n/);
  const seen = new Set();
  const candidates = [];
  for (const block of blocks) {
    const cleaned = normalizePoetry(block);
    if (!cleaned) continue;
    if (!acceptablePoetry(cleaned)) continue;
    const key = cleaned.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(cleaned);
  }
  const lo = Math.floor(candidates.length * 0.06);
  const hi = Math.ceil(candidates.length * 0.96);
  const body = candidates.slice(lo, hi);
  const picks = [];
  if (body.length) {
    const step = Math.max(1, Math.floor(body.length / PER_BOOK_POETRY));
    for (let i = 0; i < body.length && picks.length < PER_BOOK_POETRY; i += step) {
      picks.push(body[i]);
    }
  }
  return picks.map((t, i) => ({
    id: `gb-${book.id}-${i + 1}`,
    title: `${book.title} — ${book.author}`,
    text: t,
    genre: book.genre,
    author: book.author,
    source: book.title,
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // genre -> array of book-lists (each book-list is that book's candidate
  // passages). Curated passages are seeded as their own list per genre so they
  // surface first in the round-robin.
  const byGenre = {};
  for (const c of CURATED) {
    (byGenre[c.genre] ||= []);
  }
  const curatedLists = {};
  for (const c of CURATED) (curatedLists[c.genre] ||= []).push(c);
  for (const g of Object.keys(curatedLists)) (byGenre[g] ||= []).unshift(curatedLists[g]);

  for (const book of CATALOG) {
    process.stdout.write(`• ${book.title} (#${book.id}) … `);
    const raw = await getRaw(book);
    if (!raw) {
      console.log('unreachable, skipped');
      continue;
    }
    const passages = book.poetry ? extractPoetry(book, raw) : extractPassages(book, raw);
    (byGenre[book.genre] ||= []).push(passages);
    console.log(`${passages.length} candidates`);
  }

  // Round-robin within each genre so different authors are represented before
  // a single book contributes a second passage; cap per genre and overall.
  const genreOrder = Object.keys(GENRES);
  const globalSeen = new Set();
  const passages = [];
  for (const g of genreOrder) {
    const lists = (byGenre[g] || []).map((arr) => arr.slice());
    let added = 0;
    let progressed = true;
    while (added < PER_GENRE && progressed) {
      progressed = false;
      for (const list of lists) {
        if (!list.length) continue;
        progressed = true;
        const p = list.shift();
        const key = p.text.slice(0, 60).toLowerCase();
        if (globalSeen.has(key)) continue;
        globalSeen.add(key);
        passages.push(p);
        if (++added >= PER_GENRE) break;
      }
    }
    if (passages.length >= GLOBAL_CAP) break;
  }
  passages.length = Math.min(passages.length, GLOBAL_CAP);

  const banner =
    '// AUTO-GENERATED by scripts/scrape-passages.mjs — do not edit by hand.\n' +
    '// Public-domain prose distilled into read-aloud passages for Practice mode.\n' +
    `// ${passages.length} passages across ${Object.keys(GENRES).length} genres.\n\n`;

  const genresLiteral =
    'export const PASSAGE_GENRES = ' + JSON.stringify(GENRES, null, 2) + ';\n\n';

  const body =
    'export const GENERATED_PASSAGES = [\n' +
    passages
      .map(
        (p) =>
          '  ' +
          JSON.stringify({
            id: p.id,
            title: p.title,
            text: p.text,
            genre: p.genre,
            author: p.author,
            source: p.source,
          }),
      )
      .join(',\n') +
    ',\n];\n';

  await writeFile(OUT_FILE, banner + genresLiteral + body, 'utf8');

  console.log('\n———');
  const counts = {};
  for (const p of passages) counts[p.genre] = (counts[p.genre] || 0) + 1;
  for (const g of genreOrder) console.log(`  ${GENRES[g]}: ${counts[g] || 0}`);
  console.log(`\nWrote ${passages.length} passages -> ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
