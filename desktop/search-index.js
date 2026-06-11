const fs = require("fs");
const path = require("path");
const {
  isKnownSupportedFilePath,
  isMarkdownFilePath,
  isTextDocumentFilePath,
  stripKnownExtension,
} = require("./document-converter");

function makeSearchExcerpt(text, index, queryLength) {
  const beforeText = text.slice(0, index).replace(/\s+/g, " ").trim();
  const matchText = text.slice(index, index + queryLength).replace(/\s+/g, " ").trim();
  const afterText = text.slice(index + queryLength).replace(/\s+/g, " ").trim();
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

  function getEntry(filePath) {
    if (!filePath || !fs.existsSync(filePath) || !canSearchFileContents(filePath)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    const cached = cache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      raw,
      lower: raw.toLowerCase(),
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
      const end = Math.min(index + 25, paths.length);
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

  function search(query, items, limit = 80) {
    if (!query || query.length < 2) return [];

    const results = [];
    const maxMatchesPerFile = 8;
    for (const item of items) {
      if (!item.fsPath || !fs.existsSync(item.fsPath)) continue;
      if (!isKnownSupportedFilePath(item.fsPath)) continue;

      const fileName = item.fileName || path.basename(item.fsPath);
      const relativePath = item.relativePath || fileName;
      const title = item.title || stripKnownExtension(fileName);
      const titleScore = String(title).toLowerCase().includes(query) ? 5 : 0;
      const fileNameScore = String(fileName).toLowerCase().includes(query) ? 4 : 0;
      const pathScore = String(relativePath).toLowerCase().includes(query) ? 2 : 0;
      const baseScore = titleScore + fileNameScore + pathScore;
      const contentMatches = [];

      try {
        if (canSearchFileContents(item.fsPath)) {
          const entry = getEntry(item.fsPath);
          if (!entry) continue;
          let index = entry.lower.indexOf(query);
          let ordinal = 0;
          while (index !== -1 && contentMatches.length < maxMatchesPerFile) {
            contentMatches.push({
              index,
              ordinal,
              excerpt: makeSearchExcerpt(entry.raw, index, query.length),
            });
            ordinal += 1;
            index = entry.lower.indexOf(query, index + query.length);
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

  return { prime, search };
}

module.exports = { createSearchIndex };
