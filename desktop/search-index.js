const fs = require("fs");
const path = require("path");
const {
  isKnownSupportedFilePath,
  isMarkdownFilePath,
  isTextDocumentFilePath,
  stripKnownExtension,
} = require("./document-converter");
const { normalizeForSearch, prepareHaystack } = require("./unicode-search");

function makeSearchExcerpt(text, index, matchLength) {
  const beforeText = text.slice(0, index).replace(/\s+/g, " ").trim();
  const matchText = text.slice(index, index + matchLength).replace(/\s+/g, " ").trim();
  const afterText = text.slice(index + matchLength).replace(/\s+/g, " ").trim();
  const beforeWords = beforeText ? beforeText.split(" ") : [];
  const afterWords = afterText ? afterText.split(" ") : [];
  const parts = [];

  if (beforeWords.length > 10) parts.push("...");
  parts.push(...beforeWords.slice(-10));
  if (matchText) parts.push(matchText);
  parts.push(...afterWords.slice(0, 10));
  if (afterWords.length > 10) parts.push("...");

  return parts.join(" ").trim();
}

function canSearchFileContents(filePath) {
  return isMarkdownFilePath(filePath) || isTextDocumentFilePath(filePath);
}

function createSearchIndex() {
  const cache = new Map();
  const MAX_INDEXABLE_BYTES = 2 * 1024 * 1024;
  const PRIME_BATCH_SIZE = 5;

  function getEntry(filePath) {
    if (!filePath || !fs.existsSync(filePath) || !canSearchFileContents(filePath)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    if (stat.size > MAX_INDEXABLE_BYTES) {
      return null;
    }
    const cached = cache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      raw,
      haystack: prepareHaystack(raw),
    };
    cache.set(filePath, entry);
    return entry;
  }

  function prime(items) {
    const paths = [
      ...new Set(
        items
          .map((item) => item && item.fsPath)
          .filter((filePath) => filePath && canSearchFileContents(filePath)),
      ),
    ];
    let index = 0;

    const step = () => {
      const end = Math.min(index + PRIME_BATCH_SIZE, paths.length);
      for (; index < end; index += 1) {
        try {
          getEntry(paths[index]);
        } catch (err) {
          console.error("Failed to index file for search:", paths[index], err);
        }
      }
      if (index < paths.length) setTimeout(step, 0);
    };

    step();
  }

  function search(query, items, limit = 10000) {
    if (!query || query.length < 2) return [];

    const normQuery = normalizeForSearch(query);
    if (!normQuery) return [];

    const results = [];
    const maxMatchesPerFile = 10000;
    for (const item of items) {
      if (!item.fsPath || !fs.existsSync(item.fsPath)) continue;
      if (!isKnownSupportedFilePath(item.fsPath)) continue;

      const fileName = item.fileName || path.basename(item.fsPath);
      const relativePath = item.relativePath || fileName;
      const title = item.title || stripKnownExtension(fileName);
      const titleScore = normalizeForSearch(String(title)).includes(normQuery) ? 5 : 0;
      const fileNameScore = normalizeForSearch(String(fileName)).includes(normQuery) ? 4 : 0;
      const pathScore = normalizeForSearch(String(relativePath)).includes(normQuery) ? 2 : 0;
      const baseScore = titleScore + fileNameScore + pathScore;
      const contentMatches = [];

      try {
        if (canSearchFileContents(item.fsPath)) {
          const entry = getEntry(item.fsPath);
          if (!entry) continue;
          
          let nextNormIndex = 0;
          let ordinal = 0;
          
          while (contentMatches.length < maxMatchesPerFile) {
            const result = entry.haystack.indexOfNormalized(normQuery, nextNormIndex);
            if (!result) break;
            
            const textBefore = entry.raw.slice(0, result.match.index);
            const lineNumber = textBefore.split("\n").length;

            contentMatches.push({
              index: result.match.index,
              ordinal,
              excerpt: makeSearchExcerpt(entry.raw, result.match.index, result.match.matchLength),
              matchLength: result.match.matchLength,
              lineNumber,
            });
            
            ordinal += 1;
            nextNormIndex = result.nextNormIndex;
          }
        }
      } catch (err) {
        console.error("Failed to search file:", item.fsPath, err);
      }

      if (contentMatches.length > 0) {
        for (const match of contentMatches) {
          results.push({
            ...item,
            title,
            fileName,
            relativePath,
            excerpt: match.excerpt,
            matchIndex: match.index,
            matchOrdinal: match.ordinal,
            matchLength: match.matchLength,
            lineNumber: match.lineNumber,
            score: baseScore + 3 - Math.min(match.ordinal, 20) / 100,
          });
        }
      } else if (baseScore > 0) {
        results.push({ ...item, title, fileName, relativePath, excerpt: "", score: baseScore });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(({ score, ...result }) => result);
  }


  async function searchIncremental(query, items, options = {}) {
    const {
      batchSize = 100,
      maxResults = 2000,
      maxMatchesPerFile = 200,
      yieldEvery = 25,
      shouldCancel = () => false,
      onBatch = () => {},
    } = options;

    if (!query || query.length < 2) {
      return { total: 0, truncated: false, cancelled: false };
    }

    const normQuery = normalizeForSearch(query);
    if (!normQuery) {
      return { total: 0, truncated: false, cancelled: false };
    }

    let batch = [];
    let total = 0;
    let workSinceYield = 0;
    let truncated = false;

    const flush = () => {
      if (batch.length === 0) return;
      batch.sort((a, b) => b.score - a.score);
      onBatch(batch.map(({ score, ...result }) => result));
      batch = [];
    };

    const yieldAndCheckCancellation = async () => {
      workSinceYield += 1;
      if (workSinceYield < Math.max(1, yieldEvery)) return false;
      workSinceYield = 0;
      await new Promise((resolve) => setImmediate(resolve));
      return shouldCancel();
    };

    const pushResult = (result) => {
      if (total >= maxResults) {
        truncated = true;
        return false;
      }
      batch.push(result);
      total += 1;
      if (batch.length >= batchSize) flush();
      return true;
    };

    searchItems:
    for (const item of items) {
      if (shouldCancel()) {
        flush();
        return { total, truncated, cancelled: true };
      }
      if (!item.fsPath || !fs.existsSync(item.fsPath)) continue;
      if (!isKnownSupportedFilePath(item.fsPath)) continue;

      const fileName = item.fileName || path.basename(item.fsPath);
      const relativePath = item.relativePath || fileName;
      const title = item.title || stripKnownExtension(fileName);
      const titleScore = normalizeForSearch(String(title)).includes(normQuery) ? 5 : 0;
      const fileNameScore = normalizeForSearch(String(fileName)).includes(normQuery) ? 4 : 0;
      const pathScore = normalizeForSearch(String(relativePath)).includes(normQuery) ? 2 : 0;
      const baseScore = titleScore + fileNameScore + pathScore;
      let matchCount = 0;

      try {
        if (canSearchFileContents(item.fsPath)) {
          const entry = getEntry(item.fsPath);
          if (entry) {
            let nextNormIndex = 0;
            let ordinal = 0;
            let lineNumber = 1;
            let lineCursor = 0;

            while (matchCount < maxMatchesPerFile) {
              const result = entry.haystack.indexOfNormalized(normQuery, nextNormIndex);
              if (!result) break;

              let nextLineBreak = entry.raw.indexOf("\n", lineCursor);
              while (nextLineBreak !== -1 && nextLineBreak < result.match.index) {
                lineNumber += 1;
                lineCursor = nextLineBreak + 1;
                nextLineBreak = entry.raw.indexOf("\n", lineCursor);
              }

              if (!pushResult({
                ...item,
                title,
                fileName,
                relativePath,
                excerpt: makeSearchExcerpt(entry.raw, result.match.index, result.match.matchLength),
                matchIndex: result.match.index,
                matchOrdinal: ordinal,
                matchLength: result.match.matchLength,
                lineNumber,
                score: baseScore + 3 - Math.min(ordinal, 20) / 100,
              })) {
                break searchItems;
              }

              matchCount += 1;
              ordinal += 1;
              nextNormIndex = result.nextNormIndex;

              if (await yieldAndCheckCancellation()) {
                flush();
                return { total, truncated, cancelled: true };
              }
            }

            if (matchCount >= maxMatchesPerFile) truncated = true;
          }
        }
      } catch (err) {
        console.error("Failed to search file:", item.fsPath, err);
      }

      if (matchCount === 0 && baseScore > 0) {
        if (!pushResult({ ...item, title, fileName, relativePath, excerpt: "", score: baseScore })) {
          break;
        }
      }

      if (await yieldAndCheckCancellation()) {
        flush();
        return { total, truncated, cancelled: true };
      }
    }

    flush();
    return { total, truncated, cancelled: false };
  }
  return { prime, search, searchIncremental };
}

module.exports = { createSearchIndex };
