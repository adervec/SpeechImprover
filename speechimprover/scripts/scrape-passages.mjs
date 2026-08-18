#!/usr/bin/env node
// Scrapes public-domain prose from Project Gutenberg and distills it into
// short, read-aloud-sized passages for the Practice "read provided text" mode.
//
//   node scripts/scrape-passages.mjs            # use cache when present
//   node scripts/scrape-passages.mjs --refresh  # re-download everything
//
// Output: src/lib/readingPassages.generated.js  (committed to the repo).
//
// RIGHTS POLICY — every catalog entry must be public domain *worldwide*, not
// just in the US:
//   • published ≤ (this year − 96)   → US public domain (95-year rule)
//   • everyone with a copyright interest (author AND translator) died
//     ≤ (this year − 71)             → life+70 public domain (EU/UK/etc.)
// Entries carry `pub` (first publication year) and `died` (latest death year
// among author/translator). Anything failing the policy is skipped and logged.
// Translations are only used when the *translator* also clears life+70.
//
// PROVENANCE CHECK — a wrong Gutenberg id silently attributes the wrong book,
// so every fetched text's "Title:" / "Language:" header is verified against
// the catalog entry before extraction; mismatches are skipped and logged.
//
// We strip every Project Gutenberg header/footer/boilerplate so the emitted
// data contains only the underlying public-domain prose, attributed by
// original title + author. Nothing Gutenberg-trademarked survives.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'literary', pub: 1813, died: 1817 },
  { id: 158, title: 'Emma', author: 'Jane Austen', genre: 'literary', pub: 1815, died: 1817 },
  { id: 161, title: 'Sense and Sensibility', author: 'Jane Austen', genre: 'literary', pub: 1811, died: 1817 },
  { id: 105, title: 'Persuasion', author: 'Jane Austen', genre: 'literary', pub: 1817, died: 1817 },
  { id: 1260, title: 'Jane Eyre', author: 'Charlotte Brontë', genre: 'literary', pub: 1847, died: 1855 },
  { id: 768, title: 'Wuthering Heights', author: 'Emily Brontë', genre: 'literary', pub: 1847, died: 1848 },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens', genre: 'literary', pub: 1859, died: 1870 },
  { id: 1400, title: 'Great Expectations', author: 'Charles Dickens', genre: 'literary', pub: 1861, died: 1870 },
  { id: 730, title: 'Oliver Twist', author: 'Charles Dickens', genre: 'literary', pub: 1838, died: 1870 },
  { id: 1023, title: 'Bleak House', author: 'Charles Dickens', genre: 'literary', pub: 1853, died: 1870 },
  { id: 766, title: 'David Copperfield', author: 'Charles Dickens', genre: 'literary', pub: 1850, died: 1870 },
  { id: 76, title: 'Adventures of Huckleberry Finn', author: 'Mark Twain', genre: 'literary', pub: 1884, died: 1910 },
  { id: 74, title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', genre: 'literary', pub: 1876, died: 1910 },
  { id: 2701, title: 'Moby-Dick', gbTitle: 'Moby Dick', author: 'Herman Melville', genre: 'literary', pub: 1851, died: 1891 },
  { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', genre: 'literary', pub: 1890, died: 1900 },
  { id: 1399, title: 'Anna Karenina', author: 'Leo Tolstoy', translator: 'Constance Garnett', genre: 'literary', pub: 1901, died: 1946 },
  { id: 2600, title: 'War and Peace', author: 'Leo Tolstoy', translator: 'Louise & Aylmer Maude', genre: 'literary', pub: 1922, died: 1939 },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', translator: 'Constance Garnett', genre: 'literary', pub: 1914, died: 1946 },
  { id: 600, title: 'Notes from the Underground', author: 'Fyodor Dostoevsky', translator: 'Constance Garnett', genre: 'literary', pub: 1918, died: 1946 },
  { id: 996, title: 'Don Quixote', author: 'Miguel de Cervantes', translator: 'John Ormsby', genre: 'literary', pub: 1885, died: 1895 },
  { id: 145, title: 'Middlemarch', author: 'George Eliot', genre: 'literary', pub: 1871, died: 1880 },
  { id: 6688, title: 'The Mill on the Floss', author: 'George Eliot', genre: 'literary', pub: 1860, died: 1880 },
  { id: 432, title: 'The Ambassadors', author: 'Henry James', genre: 'literary', pub: 1903, died: 1916 },
  { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'literary', pub: 1925, died: 1940 },
  { id: 33, title: 'The Scarlet Letter', author: 'Nathaniel Hawthorne', genre: 'literary', pub: 1850, died: 1864 },
  { id: 219, title: 'Heart of Darkness', author: 'Joseph Conrad', genre: 'literary', pub: 1899, died: 1924 },
  { id: 974, title: 'The Secret Agent', author: 'Joseph Conrad', genre: 'literary', pub: 1907, died: 1924 },
  { id: 2814, title: 'Dubliners', author: 'James Joyce', genre: 'literary', pub: 1914, died: 1941 },
  { id: 4217, title: 'A Portrait of the Artist as a Young Man', author: 'James Joyce', genre: 'literary', pub: 1916, died: 1941 },
  { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman', genre: 'literary', pub: 1892, died: 1935 },
  { id: 160, title: 'The Awakening', author: 'Kate Chopin', genre: 'literary', pub: 1899, died: 1904 },
  { id: 541, title: 'The Age of Innocence', author: 'Edith Wharton', genre: 'literary', pub: 1920, died: 1937 },
  { id: 284, title: 'The House of Mirth', author: 'Edith Wharton', genre: 'literary', pub: 1905, died: 1937 },
  { id: 4517, title: 'Ethan Frome', author: 'Edith Wharton', genre: 'literary', pub: 1911, died: 1937 },
  { id: 242, title: 'My Ántonia', gbTitle: 'My Antonia', author: 'Willa Cather', genre: 'literary', pub: 1918, died: 1947 },
  { id: 543, title: 'Main Street', author: 'Sinclair Lewis', genre: 'literary', pub: 1920, died: 1951 },
  { id: 2775, title: 'The Good Soldier', author: 'Ford Madox Ford', genre: 'literary', pub: 1915, died: 1939 },
  { id: 217, title: 'Sons and Lovers', author: 'D. H. Lawrence', genre: 'literary', pub: 1913, died: 1930 },
  { id: 2084, title: 'The Way of All Flesh', author: 'Samuel Butler', genre: 'literary', pub: 1903, died: 1902 },
  { id: 110, title: 'Tess of the d’Urbervilles', gbTitle: "Tess of the d'Urbervilles", author: 'Thomas Hardy', genre: 'literary', pub: 1891, died: 1928 },
  { id: 153, title: 'Jude the Obscure', author: 'Thomas Hardy', genre: 'literary', pub: 1895, died: 1928 },
  { id: 1245, title: 'Night and Day', author: 'Virginia Woolf', genre: 'literary', pub: 1919, died: 1941 },
  { id: 1257, title: 'The Three Musketeers', author: 'Alexandre Dumas', translator: 'William Robson', genre: 'adventure', pub: 1844, died: 1878 },
  { id: 12, title: 'Through the Looking-Glass', author: 'Lewis Carroll', genre: 'children', pub: 1871, died: 1898 },
  { id: 2148, title: 'The Works of Edgar Allan Poe, Volume 2', gbTitle: 'The Works of Edgar Allan Poe', author: 'Edgar Allan Poe', genre: 'scifi', pub: 1845, died: 1849 },
  { id: 932, title: 'The Fall of the House of Usher', author: 'Edgar Allan Poe', genre: 'scifi', pub: 1839, died: 1849 },
  { id: 2147, title: 'The Works of Edgar Allan Poe, Volume 1', gbTitle: 'The Works of Edgar Allan Poe', author: 'Edgar Allan Poe', genre: 'mystery', pub: 1841, died: 1849 },

  // --- adventure ---
  { id: 120, title: 'Treasure Island', author: 'Robert Louis Stevenson', genre: 'adventure', pub: 1883, died: 1894 },
  { id: 86, title: "A Connecticut Yankee in King Arthur's Court", author: 'Mark Twain', genre: 'adventure', pub: 1889, died: 1910 },
  { id: 1184, title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', translator: 'anonymous (Chapman & Hall, 1846)', genre: 'adventure', pub: 1846, died: 1870 },
  { id: 103, title: 'Around the World in Eighty Days', author: 'Jules Verne', translator: 'George Makepeace Towle', genre: 'adventure', pub: 1873, died: 1905 },
  { id: 164, title: 'Twenty Thousand Leagues under the Sea', author: 'Jules Verne', translator: 'Lewis Page Mercier', genre: 'adventure', pub: 1873, died: 1905 },
  { id: 83, title: 'From the Earth to the Moon', author: 'Jules Verne', translator: 'Louis Mercier & Eleanor King', genre: 'adventure', pub: 1873, died: 1905 },
  { id: 18857, title: 'A Journey to the Centre of the Earth', gbTitle: 'Journey to the Centre of the Earth', author: 'Jules Verne', translator: 'Frederick Amadeus Malleson', genre: 'adventure', pub: 1877, died: 1905 },
  { id: 1268, title: 'The Mysterious Island', author: 'Jules Verne', translator: 'W. H. G. Kingston', genre: 'adventure', pub: 1875, died: 1905 },
  { id: 215, title: 'The Call of the Wild', author: 'Jack London', genre: 'adventure', pub: 1903, died: 1916 },
  { id: 910, title: 'White Fang', author: 'Jack London', genre: 'adventure', pub: 1906, died: 1916 },
  { id: 1056, title: 'Martin Eden', author: 'Jack London', genre: 'literary', pub: 1909, died: 1916 },
  { id: 236, title: 'The Jungle Book', author: 'Rudyard Kipling', genre: 'adventure', pub: 1894, died: 1936 },
  { id: 2186, title: 'Captains Courageous', author: 'Rudyard Kipling', genre: 'adventure', pub: 1897, died: 1936 },
  { id: 2226, title: 'Kim', author: 'Rudyard Kipling', genre: 'adventure', pub: 1901, died: 1936 },
  { id: 139, title: 'The Lost World', author: 'Arthur Conan Doyle', genre: 'adventure', pub: 1912, died: 1930 },
  { id: 558, title: 'The Thirty-Nine Steps', author: 'John Buchan', genre: 'adventure', pub: 1915, died: 1940 },
  { id: 521, title: 'Robinson Crusoe', gbTitle: 'Robinson Crusoe', author: 'Daniel Defoe', genre: 'adventure', pub: 1719, died: 1731 },
  { id: 2166, title: "King Solomon's Mines", author: 'H. Rider Haggard', genre: 'adventure', pub: 1885, died: 1925 },
  { id: 3155, title: 'She', author: 'H. Rider Haggard', genre: 'adventure', pub: 1887, died: 1925 },
  { id: 60, title: 'The Scarlet Pimpernel', author: 'Baroness Orczy', genre: 'adventure', pub: 1905, died: 1947 },
  { id: 78, title: 'Tarzan of the Apes', author: 'Edgar Rice Burroughs', genre: 'adventure', pub: 1912, died: 1950 },
  { id: 62, title: 'A Princess of Mars', author: 'Edgar Rice Burroughs', genre: 'adventure', pub: 1912, died: 1950 },
  { id: 2360, title: 'The Riddle of the Sands', author: 'Erskine Childers', genre: 'adventure', pub: 1903, died: 1922 },
  { id: 1727, title: 'The Odyssey', author: 'Homer', translator: 'Samuel Butler', genre: 'adventure', pub: 1900, died: 1902 },
  { id: 6130, title: 'The Iliad', author: 'Homer', translator: 'Alexander Pope', genre: 'adventure', pub: 1720, died: 1744, poetry: true },
  { id: 4085, title: 'The Adventures of Roderick Random', author: 'Tobias Smollett', genre: 'adventure', pub: 1748, died: 1771 },
  { id: 1947, title: 'Scaramouche', author: 'Rafael Sabatini', genre: 'adventure', pub: 1921, died: 1950 },
  { id: 1965, title: 'Captain Blood', author: 'Rafael Sabatini', genre: 'adventure', pub: 1922, died: 1950 },

  // --- mystery & detective ---
  { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1892, died: 1930 },
  { id: 2852, title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1902, died: 1930 },
  { id: 244, title: 'A Study in Scarlet', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1887, died: 1930 },
  { id: 2097, title: 'The Sign of the Four', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1890, died: 1930 },
  { id: 834, title: 'The Memoirs of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1893, died: 1930 },
  { id: 108, title: 'The Return of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1905, died: 1930 },
  { id: 3289, title: 'The Valley of Fear', author: 'Arthur Conan Doyle', genre: 'mystery', pub: 1915, died: 1930 },
  { id: 155, title: 'The Moonstone', author: 'Wilkie Collins', genre: 'mystery', pub: 1868, died: 1889 },
  { id: 583, title: 'The Woman in White', author: 'Wilkie Collins', genre: 'mystery', pub: 1859, died: 1889 },
  { id: 1695, title: 'The Man Who Was Thursday', author: 'G. K. Chesterton', genre: 'mystery', pub: 1908, died: 1936 },
  { id: 204, title: 'The Innocence of Father Brown', author: 'G. K. Chesterton', genre: 'mystery', pub: 1911, died: 1936 },
  { id: 8492, title: 'The King in Yellow', author: 'Robert W. Chambers', genre: 'mystery', pub: 1895, died: 1933 },
  { id: 863, title: 'The Mysterious Affair at Styles', author: 'Agatha Christie', genre: 'mystery', pub: 1920, died: 1976 }, // ✗ life+70 until 2047 — skipped by policy, kept for the record
  { id: 5148, title: 'The Circular Staircase', author: 'Mary Roberts Rinehart', genre: 'mystery', pub: 1908, died: 1958 }, // ✗ life+70 until 2029
  { id: 175, title: 'The Phantom of the Opera', author: 'Gaston Leroux', translator: 'Alexander Teixeira de Mattos', genre: 'mystery', pub: 1911, died: 1927 },

  // --- science fiction & gothic ---
  { id: 84, title: 'Frankenstein', author: 'Mary Shelley', genre: 'scifi', pub: 1818, died: 1851 },
  { id: 345, title: 'Dracula', author: 'Bram Stoker', genre: 'scifi', pub: 1897, died: 1912 },
  { id: 43, title: 'The Strange Case of Dr Jekyll and Mr Hyde', gbTitle: 'Dr. Jekyll and Mr. Hyde', author: 'Robert Louis Stevenson', genre: 'scifi', pub: 1886, died: 1894 },
  { id: 35, title: 'The Time Machine', author: 'H. G. Wells', genre: 'scifi', pub: 1895, died: 1946 },
  { id: 36, title: 'The War of the Worlds', author: 'H. G. Wells', genre: 'scifi', pub: 1898, died: 1946 },
  { id: 5230, title: 'The Invisible Man', author: 'H. G. Wells', genre: 'scifi', pub: 1897, died: 1946 },
  { id: 159, title: 'The Island of Doctor Moreau', author: 'H. G. Wells', genre: 'scifi', pub: 1896, died: 1946 },
  { id: 718, title: 'Tono-Bungay', author: 'H. G. Wells', genre: 'literary', pub: 1909, died: 1946 },
  { id: 209, title: 'The Turn of the Screw', author: 'Henry James', genre: 'scifi', pub: 1898, died: 1916 },
  { id: 41, title: 'The Legend of Sleepy Hollow', author: 'Washington Irving', genre: 'scifi', pub: 1820, died: 1859 },
  { id: 5200, title: 'Metamorphosis', author: 'Franz Kafka', translator: 'David Wyllie (© 2002)', genre: 'scifi', pub: 2002, died: 2050 }, // ✗ translation is copyrighted — skipped by policy
  { id: 696, title: 'The Castle of Otranto', author: 'Horace Walpole', genre: 'scifi', pub: 1764, died: 1797 },
  { id: 10007, title: 'Carmilla', author: 'J. Sheridan Le Fanu', genre: 'scifi', pub: 1872, died: 1873 },
  { id: 3095, title: 'The Lady of the Shroud', author: 'Bram Stoker', genre: 'scifi', pub: 1909, died: 1912 },
  { id: 20387, title: 'The Republic of the Southern Cross', gbTitle: 'Republic of the Southern Cross', author: 'Valery Brussof', translator: 'Stephen Graham', genre: 'scifi', pub: 1918, died: 1975 }, // ✗ translator d. 1975 — skipped by policy
  { id: 1250, title: 'Anthem', author: 'Ayn Rand', genre: 'scifi', pub: 1938, died: 1982 }, // ✗ skipped by policy
  { id: 25439, title: 'Looking Backward: 2000–1887', gbTitle: 'Looking Backward', author: 'Edward Bellamy', genre: 'scifi', pub: 1888, died: 1898 },
  { id: 3479, title: 'The Metal Monster', author: 'A. Merritt', genre: 'scifi', pub: 1920, died: 1943 },
  { id: 32154, title: 'The Variable Man', author: 'Philip K. Dick', genre: 'scifi', pub: 1953, died: 1982 }, // ✗ skipped by policy
  { id: 2130, title: 'Utopia', author: 'Thomas More', translator: 'Ralph Robinson', genre: 'scifi', pub: 1551, died: 1577 },

  // --- children's & whimsical ---
  { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', genre: 'children', pub: 1865, died: 1898 },
  { id: 289, title: 'The Wind in the Willows', author: 'Kenneth Grahame', genre: 'children', pub: 1908, died: 1932 },
  { id: 113, title: 'The Secret Garden', author: 'Frances Hodgson Burnett', genre: 'children', pub: 1911, died: 1924 },
  { id: 479, title: 'Little Lord Fauntleroy', author: 'Frances Hodgson Burnett', genre: 'children', pub: 1886, died: 1924 },
  { id: 514, title: 'Little Women', author: 'Louisa May Alcott', genre: 'children', pub: 1868, died: 1888 },
  { id: 271, title: 'Black Beauty', author: 'Anna Sewell', genre: 'children', pub: 1877, died: 1878 },
  { id: 16, title: 'Peter Pan', author: 'J. M. Barrie', genre: 'children', pub: 1911, died: 1937, restricted: 'UK: perpetual GOSH royalty right (CDPA 1988 s.301) — excluded to keep the corpus unencumbered' },
  { id: 55, title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', genre: 'children', pub: 1900, died: 1919 },
  { id: 54, title: 'The Marvelous Land of Oz', author: 'L. Frank Baum', genre: 'children', pub: 1904, died: 1919 },
  { id: 5314, title: 'Household Tales by Brothers Grimm', gbTitle: 'Household Tales', author: 'Brothers Grimm', translator: 'Margaret Hunt', genre: 'children', pub: 1884, died: 1912 },
  { id: 27200, title: 'Fairy Tales of Hans Christian Andersen', author: 'Hans Christian Andersen', translator: 'H. P. Paull', genre: 'children', pub: 1872, died: 1888 },
  { id: 21, title: "Aesop's Fables", gbTitle: 'Aesop', author: 'Aesop', translator: 'George Fyler Townsend', genre: 'children', pub: 1867, died: 1900 },
  { id: 902, title: 'The Happy Prince, and Other Tales', gbTitle: 'The Happy Prince', author: 'Oscar Wilde', genre: 'children', pub: 1888, died: 1900 },
  { id: 2781, title: 'Just So Stories', author: 'Rudyard Kipling', genre: 'children', pub: 1902, died: 1936 },
  { id: 32, title: 'Herland', author: 'Charlotte Perkins Gilman', genre: 'children', pub: 1915, died: 1935 },
  { id: 5670, title: "Jacob's Room", author: 'Virginia Woolf', genre: 'literary', pub: 1922, died: 1941 },
  { id: 500, title: 'The Adventures of Pinocchio', gbTitle: 'Pinocchio', author: 'Carlo Collodi', translator: 'Carol Della Chiesa', genre: 'children', pub: 1926, died: 1966 }, // ✗ translator — skipped by policy
  { id: 1874, title: 'Heidi', author: 'Johanna Spyri', translator: 'Elisabeth P. Stork', genre: 'children', pub: 1915, died: 1963 }, // ✗ translator — skipped by policy
  { id: 940, title: 'The Last of the Mohicans', author: 'James Fenimore Cooper', genre: 'adventure', pub: 1826, died: 1851 },
  { id: 4300, title: 'Ulysses', author: 'James Joyce', genre: 'literary', pub: 1922, died: 1941 },
  { id: 3825, title: 'Pygmalion', author: 'George Bernard Shaw', genre: 'oratory', pub: 1913, died: 1950 },
  { id: 3328, title: 'Man and Superman', author: 'George Bernard Shaw', genre: 'oratory', pub: 1903, died: 1950 },
  { id: 844, title: 'The Importance of Being Earnest', author: 'Oscar Wilde', genre: 'oratory', pub: 1895, died: 1900 },
  { id: 790, title: 'Lady Windermere’s Fan', gbTitle: "Lady Windermere's Fan", author: 'Oscar Wilde', genre: 'oratory', pub: 1893, died: 1900 },
  { id: 2542, title: 'A Doll’s House', gbTitle: "A Doll's House", author: 'Henrik Ibsen', translator: 'R. Farquharson Sharp', genre: 'oratory', pub: 1910, died: 1945 },
  { id: 13415, title: 'The Lady with the Dog and Other Stories', gbTitle: 'The Lady with the Dog', author: 'Anton Chekhov', translator: 'Constance Garnett', genre: 'literary', pub: 1917, died: 1946 },
  { id: 1732, title: 'The Schoolmistress, and Other Stories', gbTitle: 'The schoolmistress', author: 'Anton Chekhov', translator: 'Constance Garnett', genre: 'literary', pub: 1920, died: 1946 },
  { id: 3600, title: 'Essays of Michel de Montaigne', gbTitle: 'Essays of Michel de Montaigne', author: 'Michel de Montaigne', translator: 'Charles Cotton', genre: 'philosophy', pub: 1685, died: 1687 },
  { id: 8800, title: 'The Divine Comedy', gbTitle: 'Divine Comedy', author: 'Dante Alighieri', translator: 'Henry Wadsworth Longfellow', genre: 'poetry', pub: 1867, died: 1882, poetry: true },
  { id: 246, title: 'Rubáiyát of Omar Khayyám', gbTitle: 'Rubaiyat of Omar Khayyam', author: 'Omar Khayyám', translator: 'Edward FitzGerald', genre: 'poetry', pub: 1859, died: 1883, poetry: true },

  // --- essays & non-fiction ---
  { id: 205, title: 'Walden', author: 'Henry David Thoreau', genre: 'nonfiction', pub: 1854, died: 1862 },
  { id: 71, title: 'Civil Disobedience', gbTitle: 'On the Duty of Civil Disobedience', author: 'Henry David Thoreau', genre: 'nonfiction', pub: 1849, died: 1862 },
  { id: 16643, title: 'Essays', gbTitle: 'Essays', author: 'Ralph Waldo Emerson', genre: 'nonfiction', pub: 1841, died: 1882 },
  { id: 2944, title: 'Essays, Second Series', gbTitle: 'Essays', author: 'Ralph Waldo Emerson', genre: 'nonfiction', pub: 1844, died: 1882 },
  { id: 1228, title: 'On the Origin of Species', author: 'Charles Darwin', genre: 'nonfiction', pub: 1859, died: 1882 },
  { id: 944, title: 'The Voyage of the Beagle', author: 'Charles Darwin', genre: 'nonfiction', pub: 1839, died: 1882 },
  { id: 148, title: 'The Autobiography of Benjamin Franklin', gbTitle: 'Autobiography of Benjamin Franklin', author: 'Benjamin Franklin', genre: 'nonfiction', pub: 1791, died: 1790 },
  { id: 408, title: 'The Souls of Black Folk', author: 'W. E. B. Du Bois', genre: 'nonfiction', pub: 1903, died: 1963 }, // ✗ life+70 until 2034 — skipped by policy
  { id: 23, title: 'Narrative of the Life of Frederick Douglass', gbTitle: 'Narrative of the Life of Frederick Douglass', author: 'Frederick Douglass', genre: 'nonfiction', pub: 1845, died: 1895 },
  { id: 202, title: 'My Bondage and My Freedom', author: 'Frederick Douglass', genre: 'nonfiction', pub: 1855, died: 1895 },
  { id: 2376, title: 'Up from Slavery', author: 'Booker T. Washington', genre: 'nonfiction', pub: 1901, died: 1915 },
  { id: 11030, title: 'Incidents in the Life of a Slave Girl', author: 'Harriet Jacobs', genre: 'nonfiction', pub: 1861, died: 1897 },
  { id: 45631, title: 'Twelve Years a Slave', author: 'Solomon Northup', genre: 'nonfiction', pub: 1853, died: 1875 },
  { id: 3300, title: 'The Wealth of Nations', gbTitle: 'Wealth of Nations', author: 'Adam Smith', genre: 'nonfiction', pub: 1776, died: 1790 },
  { id: 3335, title: 'The Autobiography of Theodore Roosevelt', gbTitle: 'Theodore Roosevelt', author: 'Theodore Roosevelt', genre: 'nonfiction', pub: 1913, died: 1919 },
  { id: 815, title: 'Democracy in America, Volume 1', gbTitle: 'Democracy in America', author: 'Alexis de Tocqueville', translator: 'Henry Reeve', genre: 'nonfiction', pub: 1835, died: 1895 },
  { id: 816, title: 'Democracy in America, Volume 2', gbTitle: 'Democracy in America', author: 'Alexis de Tocqueville', translator: 'Henry Reeve', genre: 'nonfiction', pub: 1840, died: 1895 },
  { id: 2044, title: 'The Education of Henry Adams', author: 'Henry Adams', genre: 'nonfiction', pub: 1907, died: 1918 },
  { id: 45502, title: 'How the Other Half Lives', author: 'Jacob Riis', genre: 'nonfiction', pub: 1890, died: 1914 },
  { id: 61, title: 'The Communist Manifesto', gbTitle: 'Communist Manifesto', author: 'Marx & Engels', translator: 'Samuel Moore', genre: 'nonfiction', pub: 1888, died: 1912 },
  { id: 16317, title: 'The Art of Public Speaking', author: 'Dale Carnegie & J. Berg Esenwein', genre: 'nonfiction', pub: 1915, died: 1955 },
  { id: 37134, title: 'The Elements of Style', author: 'William Strunk Jr.', genre: 'nonfiction', pub: 1918, died: 1946 },
  { id: 368, title: 'Acres of Diamonds', author: 'Russell H. Conwell', genre: 'nonfiction', pub: 1890, died: 1925 },
  { id: 4507, title: 'As a Man Thinketh', author: 'James Allen', genre: 'nonfiction', pub: 1903, died: 1912 },
  { id: 935, title: 'Self-Help', gbTitle: 'Self-Help', author: 'Samuel Smiles', genre: 'nonfiction', pub: 1859, died: 1904 },
  { id: 5000, title: 'The Notebooks of Leonardo da Vinci', gbTitle: 'Notebooks of Leonardo', author: 'Leonardo da Vinci', translator: 'Jean Paul Richter', genre: 'nonfiction', pub: 1883, died: 1937 },
  { id: 4280, title: 'The Critique of Pure Reason', author: 'Immanuel Kant', translator: 'J. M. D. Meiklejohn', genre: 'philosophy', pub: 1855, died: 1902 },
  { id: 8117, title: 'The Possessed', author: 'Fyodor Dostoevsky', translator: 'Constance Garnett', genre: 'literary', pub: 1916, died: 1946 },
  { id: 4363, title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche', translator: 'Helen Zimmern', genre: 'philosophy', pub: 1906, died: 1934 },
  { id: 1998, title: 'Thus Spake Zarathustra', author: 'Friedrich Nietzsche', translator: 'Thomas Common', genre: 'philosophy', pub: 1909, died: 1919 },
  { id: 4705, title: 'A Treatise of Human Nature', author: 'David Hume', genre: 'philosophy', pub: 1739, died: 1776 },
  { id: 9662, title: 'An Enquiry Concerning Human Understanding', gbTitle: 'Enquiry Concerning Human Understanding', author: 'David Hume', genre: 'philosophy', pub: 1748, died: 1776 },
  { id: 7370, title: 'Second Treatise of Government', author: 'John Locke', genre: 'philosophy', pub: 1689, died: 1704 },
  { id: 1497, title: 'The Republic', author: 'Plato', translator: 'Benjamin Jowett', genre: 'philosophy', pub: 1871, died: 1893 },
  { id: 1656, title: 'Apology', author: 'Plato', translator: 'Benjamin Jowett', genre: 'philosophy', pub: 1871, died: 1893 },
  { id: 1658, title: 'Phaedo', author: 'Plato', translator: 'Benjamin Jowett', genre: 'philosophy', pub: 1871, died: 1893 },
  { id: 8438, title: 'The Nicomachean Ethics', gbTitle: 'Ethics', author: 'Aristotle', translator: 'W. D. Ross', genre: 'philosophy', pub: 1908, died: 1971 }, // ✗ translator d. 1971 — skipped by policy
  { id: 6762, title: 'Politics', gbTitle: 'Politics', author: 'Aristotle', translator: 'Benjamin Jowett', genre: 'philosophy', pub: 1885, died: 1893 },
  { id: 871, title: 'The Golden Sayings of Epictetus', gbTitle: 'Golden Sayings of Epictetus', author: 'Epictetus', translator: 'Hastings Crossley', genre: 'philosophy', pub: 1903, died: 1926 },
  { id: 2680, title: 'Meditations', author: 'Marcus Aurelius', translator: 'George Long', genre: 'philosophy', pub: 1862, died: 1879 },
  { id: 132, title: 'The Art of War', author: 'Sun Tzu', translator: 'Lionel Giles', genre: 'philosophy', pub: 1910, died: 1958 }, // ✗ translator life+70 until 2029 — skipped by policy
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift', genre: 'philosophy', pub: 1729, died: 1745 },
  { id: 829, title: "Gulliver's Travels", author: 'Jonathan Swift', genre: 'adventure', pub: 1726, died: 1745 },
  { id: 3207, title: 'Leviathan', author: 'Thomas Hobbes', genre: 'philosophy', pub: 1651, died: 1679 },
  { id: 34901, title: 'On Liberty', author: 'John Stuart Mill', genre: 'philosophy', pub: 1859, died: 1873 },
  { id: 11224, title: 'Utilitarianism', author: 'John Stuart Mill', genre: 'philosophy', pub: 1863, died: 1873 },
  { id: 5827, title: 'The Problems of Philosophy', author: 'Bertrand Russell', genre: 'philosophy', pub: 1912, died: 1970 }, // ✗ life+70 until 2041 — skipped by policy
  { id: 4320, title: 'An Enquiry Concerning the Principles of Morals', gbTitle: 'Principles of Morals', author: 'David Hume', genre: 'philosophy', pub: 1751, died: 1776 },
  { id: 3296, title: 'The Confessions of St. Augustine', gbTitle: 'Confessions', author: 'Augustine of Hippo', translator: 'E. B. Pusey', genre: 'philosophy', pub: 1838, died: 1882 },
  { id: 5740, title: 'Tractatus Logico-Philosophicus', author: 'Ludwig Wittgenstein', translator: 'C. K. Ogden', genre: 'philosophy', pub: 1922, died: 1957 }, // ✗ translator d. 1957 — skipped by policy
  { id: 59, title: 'Discourse on the Method', gbTitle: 'Discourse on the Method', author: 'René Descartes', translator: 'John Veitch', genre: 'philosophy', pub: 1850, died: 1894 },
  { id: 3800, title: 'The Ethics', gbTitle: 'Ethics', author: 'Baruch Spinoza', translator: 'R. H. M. Elwes', genre: 'philosophy', pub: 1883, died: 1892 },
  { id: 216, title: 'Tao Te Ching', gbTitle: 'Tao Teh King', author: 'Laozi', translator: 'James Legge', genre: 'philosophy', pub: 1891, died: 1897 },

  // --- speeches & rhetoric ---
  { id: 147, title: 'Common Sense', author: 'Thomas Paine', genre: 'oratory', pub: 1776, died: 1809 },
  { id: 31270, title: 'The Writings of Thomas Paine', gbTitle: 'Writings of Thomas Paine', author: 'Thomas Paine', genre: 'oratory', pub: 1809, died: 1809 },
  { id: 1404, title: 'The Federalist Papers', author: 'Hamilton, Madison & Jay', genre: 'oratory', pub: 1788, died: 1836 },
  { id: 1, title: 'The Declaration of Independence of the United States of America', gbTitle: 'Declaration of Independence', author: 'Thomas Jefferson', genre: 'oratory', pub: 1776, died: 1826 },
  { id: 2653, title: "Lincoln's Inaugurals, Addresses and Letters", gbTitle: 'Lincoln', author: 'Abraham Lincoln', genre: 'oratory', pub: 1865, died: 1865 },
  { id: 3253, title: 'The Papers and Writings of Abraham Lincoln (Vol. 5)', gbTitle: 'Abraham Lincoln', author: 'Abraham Lincoln', genre: 'oratory', pub: 1865, died: 1865 },
  { id: 100, title: 'The Complete Works of William Shakespeare', gbTitle: 'Shakespeare', author: 'William Shakespeare', genre: 'oratory', pub: 1623, died: 1616, skip: true }, // plays: line-based, handled via CURATED soliloquies instead
  { id: 1524, title: 'Hamlet', author: 'William Shakespeare', genre: 'oratory', pub: 1603, died: 1616, skip: true },
  { id: 2264, title: 'Macbeth', author: 'William Shakespeare', genre: 'oratory', pub: 1623, died: 1616, skip: true },
  { id: 1112, title: 'Romeo and Juliet', author: 'William Shakespeare', genre: 'oratory', pub: 1597, died: 1616, skip: true },

  // --- poetry & verse ---
  { id: 1322, title: 'Leaves of Grass', author: 'Walt Whitman', genre: 'poetry', pub: 1855, died: 1892, poetry: true },
  { id: 1280, title: 'Spoon River Anthology', author: 'Edgar Lee Masters', genre: 'poetry', pub: 1915, died: 1950, poetry: true },
  { id: 19, title: 'The Song of Hiawatha', author: 'Henry Wadsworth Longfellow', genre: 'poetry', pub: 1855, died: 1882, poetry: true },
  { id: 1934, title: 'Songs of Innocence and of Experience', author: 'William Blake', genre: 'poetry', pub: 1794, died: 1827, poetry: true },
  { id: 574, title: 'Poems of William Blake', author: 'William Blake', genre: 'poetry', pub: 1794, died: 1827, poetry: true },
  { id: 12242, title: 'Poems', gbTitle: 'Poems', author: 'Emily Dickinson', genre: 'poetry', pub: 1890, died: 1886, poetry: true },
  { id: 10031, title: 'The Complete Poetical Works', gbTitle: 'Poetical Works', author: 'Edgar Allan Poe', genre: 'poetry', pub: 1845, died: 1849, poetry: true },
  { id: 1065, title: 'The Raven', author: 'Edgar Allan Poe', genre: 'poetry', pub: 1845, died: 1849, poetry: true },
  { id: 23684, title: 'Poems Published in 1820', gbTitle: 'Poems', author: 'John Keats', genre: 'poetry', pub: 1820, died: 1821, poetry: true },
  { id: 9622, title: 'Lyrical Ballads', author: 'Wordsworth & Coleridge', genre: 'poetry', pub: 1798, died: 1850, poetry: true },
  { id: 151, title: 'The Rime of the Ancient Mariner', author: 'Samuel Taylor Coleridge', genre: 'poetry', pub: 1798, died: 1834, poetry: true },
  { id: 9601, title: 'Poetical Works', gbTitle: 'Poetical Works', author: 'Alexander Pope', genre: 'poetry', pub: 1717, died: 1744, poetry: true },
  { id: 610, title: 'Idylls of the King', author: 'Alfred, Lord Tennyson', genre: 'poetry', pub: 1859, died: 1892, poetry: true },
  { id: 3026, title: 'North of Boston', author: 'Robert Frost', genre: 'poetry', pub: 1914, died: 1963, poetry: true }, // ✗ life+70 until 2034 — skipped by policy
  { id: 3021, title: "A Boy's Will", author: 'Robert Frost', genre: 'poetry', pub: 1913, died: 1963, poetry: true }, // ✗ skipped by policy
  { id: 4800, title: 'The Complete Poetical Works', gbTitle: 'Poetical Works', author: 'Percy Bysshe Shelley', genre: 'poetry', pub: 1820, died: 1822, poetry: true },
  { id: 16341, title: 'Poems', gbTitle: 'Poems', author: 'William Cullen Bryant', genre: 'poetry', pub: 1821, died: 1878, poetry: true },
  { id: 20, title: 'Paradise Lost', author: 'John Milton', genre: 'poetry', pub: 1667, died: 1674, poetry: true },
  { id: 5131, title: "Childe Harold's Pilgrimage", gbTitle: 'Childe Harold', author: 'Lord Byron', genre: 'poetry', pub: 1812, died: 1824, poetry: true },
  { id: 1034, title: 'Poems', gbTitle: 'Poems', author: 'Wilfred Owen', genre: 'poetry', pub: 1920, died: 1918, poetry: true },
  { id: 5720, title: 'A Shropshire Lad', author: 'A. E. Housman', genre: 'poetry', pub: 1896, died: 1936, poetry: true },
  { id: 16950, title: 'Goblin Market and Other Poems', gbTitle: 'Goblin Market', author: 'Christina Rossetti', genre: 'poetry', pub: 1862, died: 1894, poetry: true },
  { id: 109, title: 'Renascence and Other Poems', gbTitle: 'Renascence', author: 'Edna St. Vincent Millay', genre: 'poetry', pub: 1917, died: 1950, poetry: true },
  { id: 1057, title: 'The Ballad of Reading Gaol', gbTitle: 'Reading Gaol', author: 'Oscar Wilde', genre: 'poetry', pub: 1898, died: 1900, poetry: true },
  { id: 2819, title: 'Barrack-Room Ballads', gbTitle: 'Barrack-Room Ballads', author: 'Rudyard Kipling', genre: 'poetry', pub: 1892, died: 1936, poetry: true },
  { id: 17854, title: 'The Sport of the Gods', author: 'Paul Laurence Dunbar', genre: 'literary', pub: 1902, died: 1906 },
  { id: 8187, title: 'The Complete Poems of Sir Thomas Moore', gbTitle: 'Thomas Moore', author: 'Thomas Moore', genre: 'poetry', pub: 1841, died: 1852, poetry: true },
  { id: 3011, title: 'The Waste Land', author: 'T. S. Eliot', genre: 'poetry', pub: 1922, died: 1965, poetry: true }, // ✗ life+70 until 2036 — skipped by policy
  { id: 1156, title: 'Babbitt', author: 'Sinclair Lewis', genre: 'literary', pub: 1922, died: 1951 },
  { id: 4650, title: 'The Poems of Sappho (Wharton)', gbTitle: 'Sappho', author: 'Sappho', translator: 'Henry Thornton Wharton', genre: 'poetry', pub: 1885, died: 1895, poetry: true },
  { id: 2199, title: 'The Iliad (Butler)', gbTitle: 'Iliad', author: 'Homer', translator: 'Samuel Butler', genre: 'adventure', pub: 1898, died: 1902 },
  { id: 3252, title: 'Chicago Poems', author: 'Carl Sandburg', genre: 'poetry', pub: 1916, died: 1967, poetry: true }, // ✗ life+70 until 2038 — skipped by policy

  // --- second-pass ids (each verified against the Gutenberg header at build time) ---
  { id: 421, title: 'Kidnapped', author: 'Robert Louis Stevenson', genre: 'adventure', pub: 1886, died: 1894 },
  { id: 1074, title: 'The Sea-Wolf', gbTitle: 'The Sea Wolf', author: 'Jack London', genre: 'adventure', pub: 1904, died: 1916 },
  { id: 95, title: 'The Prisoner of Zenda', author: 'Anthony Hope', genre: 'adventure', pub: 1894, died: 1933 },
  { id: 1013, title: 'The First Men in the Moon', author: 'H. G. Wells', genre: 'scifi', pub: 1901, died: 1946 },
  { id: 1837, title: 'The Prince and the Pauper', author: 'Mark Twain', genre: 'children', pub: 1881, died: 1910 },
  { id: 14838, title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', genre: 'children', pub: 1902, died: 1943 },
  { id: 146, title: 'A Little Princess', author: 'Frances Hodgson Burnett', genre: 'children', pub: 1905, died: 1924 },
  { id: 778, title: 'Five Children and It', author: 'E. Nesbit', genre: 'children', pub: 1902, died: 1924 },
  { id: 1874, title: 'The Railway Children', author: 'E. Nesbit', genre: 'children', pub: 1906, died: 1924 },
  { id: 1600, title: 'Symposium', author: 'Plato', translator: 'Benjamin Jowett', genre: 'philosophy', pub: 1871, died: 1893 },
  { id: 3743, title: 'The Age of Reason', author: 'Thomas Paine', genre: 'oratory', pub: 1794, died: 1809 },
  { id: 9830, title: 'The Beautiful and Damned', author: 'F. Scott Fitzgerald', genre: 'literary', pub: 1922, died: 1940 },
  { id: 107, title: 'Far from the Madding Crowd', author: 'Thomas Hardy', genre: 'literary', pub: 1874, died: 1928 },
  { id: 2759, title: 'The Man in the Iron Mask', author: 'Alexandre Dumas', translator: 'anonymous (19th c.)', genre: 'adventure', pub: 1850, died: 1870 },
  { id: 1685, title: 'The Mystery of the Yellow Room', author: 'Gaston Leroux', translator: 'anonymous (1908)', genre: 'mystery', pub: 1908, died: 1927 },
  { id: 389, title: 'The Great God Pan', author: 'Arthur Machen', genre: 'scifi', pub: 1894, died: 1947 },
  { id: 1329, title: 'A Voyage to Arcturus', author: 'David Lindsay', genre: 'scifi', pub: 1920, died: 1945 },
  { id: 7986, title: 'Plays by Anton Chekhov, Second Series', gbTitle: 'Plays by Anton Chekhov', author: 'Anton Chekhov', translator: 'Julius West', genre: 'oratory', pub: 1916, died: 1918 },
  { id: 17976, title: 'Autobiography of Andrew Carnegie', gbTitle: 'Andrew Carnegie', author: 'Andrew Carnegie', genre: 'nonfiction', pub: 1920, died: 1919 },
  { id: 1937, title: 'The Second Jungle Book', author: 'Rudyard Kipling', genre: 'children', pub: 1895, died: 1936 },
  { id: 2500, title: 'Siddhartha', author: 'Hermann Hesse', translator: 'Gunther Olesch et al. (© 2001)', genre: 'philosophy', pub: 2001, died: 2062 }, // ✗ skipped by policy — recorded so nobody re-adds it
  { id: 4094, title: 'The Analects of Confucius', gbTitle: 'Analects', author: 'Confucius', translator: 'James Legge', genre: 'philosophy', pub: 1861, died: 1897 },
  { id: 5199, title: 'South: The Story of Shackleton’s Last Expedition', gbTitle: 'South', author: 'Ernest Shackleton', genre: 'adventure', pub: 1919, died: 1922 },
  { id: 3178, title: 'The Gilded Age', author: 'Mark Twain & Charles Dudley Warner', genre: 'literary', pub: 1873, died: 1910 },
].filter((b) => !b.skip);

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
  // ---- Shakespeare (d. 1616): the great speaking-practice set pieces ----
  {
    id: 'gb-curated-hamlet',
    title: 'To be, or not to be — Hamlet (Shakespeare)',
    author: 'William Shakespeare',
    genre: 'oratory',
    text: 'To be, or not to be, that is the question: whether ’tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them. To die, to sleep — no more; and by a sleep to say we end the heart-ache and the thousand natural shocks that flesh is heir to: ’tis a consummation devoutly to be wish’d.',
  },
  {
    id: 'gb-curated-stage',
    title: 'All the world’s a stage — As You Like It (Shakespeare)',
    author: 'William Shakespeare',
    genre: 'oratory',
    text: 'All the world’s a stage, and all the men and women merely players; they have their exits and their entrances, and one man in his time plays many parts, his acts being seven ages. At first the infant, mewling and puking in the nurse’s arms. Then the whining school-boy, with his satchel and shining morning face, creeping like snail unwillingly to school.',
  },
  {
    id: 'gb-curated-caesar',
    title: 'Friends, Romans, countrymen — Julius Caesar (Shakespeare)',
    author: 'William Shakespeare',
    genre: 'oratory',
    text: 'Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him. The evil that men do lives after them; the good is oft interred with their bones; so let it be with Caesar. The noble Brutus hath told you Caesar was ambitious: if it were so, it was a grievous fault, and grievously hath Caesar answer’d it.',
  },
  {
    id: 'gb-curated-crispin',
    title: 'We few, we happy few — Henry V (Shakespeare)',
    author: 'William Shakespeare',
    genre: 'oratory',
    text: 'This story shall the good man teach his son; and Crispin Crispian shall ne’er go by, from this day to the ending of the world, but we in it shall be remembered — we few, we happy few, we band of brothers; for he to-day that sheds his blood with me shall be my brother; be he ne’er so vile, this day shall gentle his condition.',
  },
  {
    id: 'gb-curated-macbeth',
    title: 'Tomorrow, and tomorrow, and tomorrow — Macbeth (Shakespeare)',
    author: 'William Shakespeare',
    genre: 'oratory',
    text: 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day, to the last syllable of recorded time; and all our yesterdays have lighted fools the way to dusty death. Out, out, brief candle! Life’s but a walking shadow, a poor player that struts and frets his hour upon the stage, and then is heard no more.',
  },
  {
    id: 'gb-curated-mercy',
    title: 'The quality of mercy — The Merchant of Venice (Shakespeare)',
    author: 'William Shakespeare',
    genre: 'oratory',
    text: 'The quality of mercy is not strain’d; it droppeth as the gentle rain from heaven upon the place beneath. It is twice blest: it blesseth him that gives and him that takes. ’Tis mightiest in the mightiest; it becomes the throned monarch better than his crown.',
  },
  // ---- more speeches (all speakers d. before 1930) ----
  {
    id: 'gb-curated-douglass',
    title: 'What to the Slave Is the Fourth of July? — Frederick Douglass',
    author: 'Frederick Douglass',
    genre: 'oratory',
    text: 'What, to the American slave, is your Fourth of July? I answer: a day that reveals to him, more than all other days in the year, the gross injustice and cruelty to which he is the constant victim. To him, your celebration is a sham; your boasted liberty, an unholy license; your national greatness, swelling vanity.',
  },
  {
    id: 'gb-curated-anthony',
    title: 'On Women’s Right to Vote — Susan B. Anthony',
    author: 'Susan B. Anthony',
    genre: 'oratory',
    text: 'Friends and fellow citizens: I stand before you tonight under indictment for the alleged crime of having voted at the last presidential election, without having a lawful right to vote. It shall be my work this evening to prove to you that in thus voting, I not only committed no crime, but, instead, simply exercised my citizen’s rights, guaranteed to me and all United States citizens by the National Constitution, beyond the power of any State to deny.',
  },
  {
    id: 'gb-curated-joseph',
    title: 'I will fight no more forever — Chief Joseph',
    author: 'Chief Joseph',
    genre: 'oratory',
    text: 'I am tired of fighting. Our chiefs are killed. The old men are all dead. It is cold, and we have no blankets; the little children are freezing to death. Hear me, my chiefs! I am tired; my heart is sick and sad. From where the sun now stands I will fight no more forever.',
  },
  {
    id: 'gb-curated-pericles',
    title: 'Funeral Oration of Pericles — Thucydides (tr. Richard Crawley)',
    author: 'Thucydides',
    genre: 'oratory',
    text: 'Our constitution does not copy the laws of neighbouring states; we are rather a pattern to others than imitators ourselves. Its administration favours the many instead of the few; this is why it is called a democracy. If we look to the laws, they afford equal justice to all in their private differences; if to social standing, advancement in public life falls to reputation for capacity, class considerations not being allowed to interfere with merit.',
  },
  {
    id: 'gb-curated-declaration',
    title: 'Declaration of Independence (preamble) — Thomas Jefferson',
    author: 'Thomas Jefferson',
    genre: 'oratory',
    text: 'We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness. That to secure these rights, Governments are instituted among Men, deriving their just powers from the consent of the governed.',
  },
  // ---- verse for pacing & projection (all poets d. before 1940) ----
  {
    id: 'gb-curated-if',
    title: 'If— (opening) — Rudyard Kipling',
    author: 'Rudyard Kipling',
    genre: 'poetry',
    text: 'If you can keep your head when all about you\nAre losing theirs and blaming it on you,\nIf you can trust yourself when all men doubt you,\nBut make allowance for their doubting too;\nIf you can wait and not be tired by waiting,\nOr being lied about, don’t deal in lies,\nOr being hated, don’t give way to hating,\nAnd yet don’t look too good, nor talk too wise.',
  },
  {
    id: 'gb-curated-invictus',
    title: 'Invictus — William Ernest Henley',
    author: 'William Ernest Henley',
    genre: 'poetry',
    text: 'Out of the night that covers me,\nBlack as the pit from pole to pole,\nI thank whatever gods may be\nFor my unconquerable soul.\nIn the fell clutch of circumstance\nI have not winced nor cried aloud.\nUnder the bludgeonings of chance\nMy head is bloody, but unbowed.',
  },
  {
    id: 'gb-curated-ozymandias',
    title: 'Ozymandias — Percy Bysshe Shelley',
    author: 'Percy Bysshe Shelley',
    genre: 'poetry',
    text: 'And on the pedestal these words appear:\n“My name is Ozymandias, king of kings:\nLook on my works, ye Mighty, and despair!”\nNothing beside remains. Round the decay\nOf that colossal wreck, boundless and bare\nThe lone and level sands stretch far away.',
  },
  {
    id: 'gb-curated-daffodils',
    title: 'I Wandered Lonely as a Cloud — William Wordsworth',
    author: 'William Wordsworth',
    genre: 'poetry',
    text: 'I wandered lonely as a cloud\nThat floats on high o’er vales and hills,\nWhen all at once I saw a crowd,\nA host, of golden daffodils;\nBeside the lake, beneath the trees,\nFluttering and dancing in the breeze.',
  },
  {
    id: 'gb-curated-tyger',
    title: 'The Tyger (opening) — William Blake',
    author: 'William Blake',
    genre: 'poetry',
    text: 'Tyger Tyger, burning bright,\nIn the forests of the night;\nWhat immortal hand or eye,\nCould frame thy fearful symmetry?\nIn what distant deeps or skies\nBurnt the fire of thine eyes?\nOn what wings dare he aspire?\nWhat the hand, dare seize the fire?',
  },
];


// ---------------------------------------------------------------------------
// Extraction tuning.
// ---------------------------------------------------------------------------
const MIN_WORDS = 45;
const MAX_WORDS = 110;
const MIN_SENTENCES = 2;
const MAX_SENTENCES = 6;
const PER_BOOK = 8; // prose candidates kept per book, spread across the text
const PER_BOOK_POETRY = 6; // verse stanzas kept per poetry book
const PER_GENRE = 110; // cap per genre, filled round-robin across that genre's books
const GLOBAL_CAP = 1000; // overall safety ceiling

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

  const skipped = [];
  const seenIds = new Set();
  for (const book of CATALOG) {
    process.stdout.write(`• ${book.title} (#${book.id}) … `);
    if (seenIds.has(book.id)) { console.log('duplicate id, skipped'); continue; }
    seenIds.add(book.id);
    const why = rightsProblem(book);
    if (why) { console.log(`RIGHTS: ${why} — skipped`); skipped.push([book, why]); continue; }
    const raw = await getRaw(book);
    if (!raw) {
      console.log('unreachable, skipped');
      continue;
    }
    const prov = provenanceProblem(book, raw);
    if (prov) { console.log(`PROVENANCE: ${prov} — skipped`); skipped.push([book, prov]); continue; }
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
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} catalog entries:`);
    for (const [b, why] of skipped) console.log(`  ✗ ${b.title} — ${b.author} (#${b.id}): ${why}`);
  }
}

// ---------------------------------------------------------------------------
// Rights policy + provenance verification (see header comment).
// ---------------------------------------------------------------------------
const THIS_YEAR = new Date().getFullYear();
const US_PUB_CUTOFF = THIS_YEAR - 96;   // published ≤ this → US public domain
const LIFE70_CUTOFF = THIS_YEAR - 71;   // died ≤ this → life+70 public domain

export function rightsProblem(book) {
  if (book.restricted) return book.restricted;
  if (book.pub == null || book.died == null) return 'missing pub/died metadata';
  if (book.pub > US_PUB_CUTOFF) return `published ${book.pub} (> ${US_PUB_CUTOFF}: not yet US public domain)`;
  if (book.died > LIFE70_CUTOFF) return `${book.translator ? 'author/translator' : 'author'} died ${book.died} (> ${LIFE70_CUTOFF}: not yet life+70 public domain)`;
  return null;
}

const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function provenanceProblem(book, raw) {
  const head = raw.slice(0, 4000);
  const title = (head.match(/^Title:\s*(.+)$/m) || [])[1] || '';
  const lang = (head.match(/^Language:\s*(.+)$/m) || [])[1] || '';
  if (!title) return 'no Title header';
  if (lang && !/english/i.test(lang)) return `language is ${lang.trim()}`;
  const want = norm(book.gbTitle || book.title);
  const got = norm(title);
  const key = want.split(' ').filter((w) => w.length > 2 && !['the', 'and', 'of'].includes(w)).slice(0, 3).join(' ');
  if (!got.includes(want) && !want.includes(got) && !(key && got.includes(key))) {
    return `title mismatch: catalog “${book.title}” vs Gutenberg “${title.trim()}”`;
  }
  return null;
}

// `--audit`: re-verify the committed output against the catalog + policy without
// touching the network. Fails (exit 1) on any passage whose book is missing from
// the catalog, fails the rights policy, or still carries Gutenberg boilerplate.
const ALLOWED_AUDIT_RE = /^[\p{L} \n.,;:!?'"()—–\-…]+$/u;

async function audit() {
  const mod = await import(pathToFileURL(OUT_FILE).href);
  const byId = new Map(CATALOG.map((b) => [String(b.id), b]));
  const curated = new Set(CURATED.map((c) => c.id));
  const problems = [];
  for (const p of mod.GENERATED_PASSAGES) {
    if (curated.has(p.id)) continue;
    const gid = p.id.split('-')[1];
    const book = byId.get(gid);
    if (!book) { problems.push(`${p.id}: book #${gid} not in catalog`); continue; }
    const why = rightsProblem(book);
    if (why) problems.push(`${p.id}: ${why}`);
    if (`${book.title} — ${book.author}` !== p.title) problems.push(`${p.id}: title drift (“${p.title}” vs catalog “${book.title} — ${book.author}”)`);
    if (/gutenberg|ebook|e-book|www\.|http/i.test(p.text)) problems.push(`${p.id}: boilerplate leaked`);
    if (!ALLOWED_AUDIT_RE.test(p.text)) problems.push(`${p.id}: unexpected characters`);
  }
  const authors = new Set(mod.GENERATED_PASSAGES.map((p) => p.author));
  console.log(`audited ${mod.GENERATED_PASSAGES.length} passages from ${authors.size} authors — ${problems.length} problem(s)`);
  for (const pr of problems) console.log('  ✗ ' + pr);
  process.exit(problems.length ? 1 : 0);
}

(process.argv.includes('--audit') ? audit() : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
