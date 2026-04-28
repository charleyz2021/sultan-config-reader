const summaryGrid = document.querySelector("#summaryGrid");
const generatedAt = document.querySelector("#generatedAt");
const explorerList = document.querySelector("#explorerList");
const explorerMeta = document.querySelector("#explorerMeta");
const detailPane = document.querySelector("#detailPane");
const searchInput = document.querySelector("#searchInput");
const exactMatchInput = document.querySelector("#exactMatchInput");
const tabs = [...document.querySelectorAll(".tab")];
const cardSubtabs = document.querySelector("#cardSubtabs");
const riteSubtabs = document.querySelector("#riteSubtabs");
const cardSubtabsButtons = [...document.querySelectorAll("[data-card-filter]")];
const riteSubtabsButtons = [...document.querySelectorAll("[data-rite-filter]")];
const detailModal = document.querySelector("#detailModal");
const detailModalBackdrop = document.querySelector("#detailModalBackdrop");
const detailModalBack = document.querySelector("#detailModalBack");
const detailModalClose = document.querySelector("#detailModalClose");
const detailModalContent = document.querySelector("#detailModalContent");
const cardPreview = document.querySelector("#cardPreview");
const cardPreviewBackdrop = document.querySelector("#cardPreviewBackdrop");
const cardPreviewBack = document.querySelector("#cardPreviewBack");
const cardPreviewClose = document.querySelector("#cardPreviewClose");
const cardPreviewContent = document.querySelector("#cardPreviewContent");
const scrollTopBtn = document.querySelector("#scrollTopBtn");
const appVersion = document.querySelector("#appVersion");
const hero = document.querySelector(".hero");
const pageShell = document.querySelector(".page-shell");
const translationData = window.SULTAN_TRANSLATIONS || {};
const APP_VERSION = "v0.1.7";
const APP_UPDATED_AT = "2026-04-28";

let currentTab = "all";
let currentCardFilter = "all";
let currentRiteFilter = "all";
let selectedKey = null;
let siteData = null;
let indices = null;
let importStatus = null;
let zipInput = null;
let folderInput = null;
let importZipBtn = null;
let importFolderBtn = null;
let clearCacheBtn = null;
let mobileDetailModalHistory = [];
let cardPreviewHistory = [];

const mobileMq = window.matchMedia("(max-width: 900px)");
const CACHE_DB_NAME = "sultan-config-reader";
const CACHE_STORE_NAME = "cache";
const CACHE_KEY = "site-data";
const CACHE_SCHEMA_VERSION = 1;

const formatDateTime = (isoString) =>
  new Date(isoString).toLocaleString("zh-CN", {
    hour12: false,
  });

const itemSelectionKey = (item) => `${item?.kind || "unknown"}:${item?.id ?? "unknown"}`;

const ensureJsZip = async () => {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./vendor/jszip.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("JSZip 加载失败"));
    document.head.appendChild(script);
  });
  return window.JSZip;
};

const openCacheDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(CACHE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const cacheSet = async (key, value) => {
  const db = await openCacheDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
    tx.objectStore(CACHE_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

const cacheGet = async (key) => {
  const db = await openCacheDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, "readonly");
    const req = tx.objectStore(CACHE_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
};

const cacheDelete = async (key) => {
  const db = await openCacheDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
    tx.objectStore(CACHE_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

const setImportBusy = (busy) => {
  [importZipBtn, importFolderBtn, clearCacheBtn].forEach((button) => {
    if (button) button.disabled = busy;
  });
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderRichText = (value) =>
  escapeHtml(value || "")
    .replace(
      /&lt;color=(#[0-9a-fA-F]{6,8}|[a-zA-Z]+)&gt;([\s\S]*?)&lt;\/color&gt;/g,
      (_match, color, inner) => `<span style="color:${color}">${inner}</span>`,
    )
    .replace(
      /&lt;cspace=([^&]+?)&gt;([\s\S]*?)&lt;\/cspace&gt;/g,
      (_match, spacing, inner) => `<span style="letter-spacing:${spacing}">${inner}</span>`,
    )
    .replace(/&lt;size=\d+&gt;([\s\S]*?)&lt;\/size&gt;/g, "$1");

const renderRichTitle = (id, label) => `${escapeHtml(String(id))} · ${renderRichText(label || "")}`;

const jsonBlock = (value) => `<pre>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2))}</pre>`;
const rawConfigBlock = (item) => `<div class="raw-config-block">${jsonBlock(item?.rawSource || item?.raw || item)}</div>`;

const stripJsonComments = (input) => {
  let out = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i];
    const next = input[i + 1];

    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        out += current;
      }
      continue;
    }

    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === "\"") {
        inString = false;
      }
      continue;
    }

    if (current === "\"") {
      inString = true;
      out += current;
      continue;
    }

    if (current === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }

    if (current === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }

    out += current;
  }

  return out;
};

const stripTrailingCommas = (input) => input.replace(/,\s*([}\]])/g, "$1");
const parseJsoncText = (input) => JSON.parse(stripTrailingCommas(stripJsonComments(input)));

const findMatchingBrace = (input, startIndex) => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < input.length; i += 1) {
    const current = input[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === "\"") inString = false;
      continue;
    }
    if (current === "\"") {
      inString = true;
      continue;
    }
    if (current === "{") depth += 1;
    if (current === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const findMatchingBracket = (input, startIndex) => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < input.length; i += 1) {
    const current = input[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === "\"") inString = false;
      continue;
    }
    if (current === "\"") {
      inString = true;
      continue;
    }
    if (current === "[") depth += 1;
    if (current === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const extractRepeatedObjectEntries = (raw, fieldName) => {
  const cleaned = stripTrailingCommas(stripJsonComments(raw));
  const marker = `"${fieldName}"`;
  const markerIndex = cleaned.indexOf(marker);
  if (markerIndex < 0) return [];
  const braceStart = cleaned.indexOf("{", markerIndex);
  if (braceStart < 0) return [];
  const braceEnd = findMatchingBrace(cleaned, braceStart);
  if (braceEnd < 0) return [];
  return extractObjectEntriesFromSnippet(cleaned.slice(braceStart, braceEnd + 1));
};

const extractObjectEntriesFromSnippet = (rawSnippet) => {
  const cleaned = stripTrailingCommas(stripJsonComments(rawSnippet || ""));
  const braceStart = cleaned.indexOf("{");
  if (braceStart < 0) return [];
  const braceEnd = findMatchingBrace(cleaned, braceStart);
  if (braceEnd < 0) return [];
  const body = cleaned.slice(braceStart + 1, braceEnd);
  const entries = [];
  let index = 0;
  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index])) index += 1;
    if (index >= body.length || body[index] !== "\"") break;
    let keyEnd = index + 1;
    let escaped = false;
    while (keyEnd < body.length) {
      const char = body[keyEnd];
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") break;
      keyEnd += 1;
    }
    const keySnippet = body.slice(index, keyEnd + 1);
    const key = JSON.parse(keySnippet);
    index = keyEnd + 1;
    while (index < body.length && /\s/.test(body[index])) index += 1;
    if (body[index] !== ":") break;
    index += 1;
    while (index < body.length && /\s/.test(body[index])) index += 1;
    const valueStart = index;
    let valueEnd = index;
    const startChar = body[index];
    if (startChar === "{") {
      const bodyOffset = braceStart + 1;
      const absoluteStart = bodyOffset + valueStart;
      const absoluteEnd = findMatchingBrace(cleaned, absoluteStart);
      if (absoluteEnd < 0) break;
      valueEnd = absoluteEnd - bodyOffset + 1;
    } else if (startChar === "[") {
      const bodyOffset = braceStart + 1;
      const absoluteStart = bodyOffset + valueStart;
      const absoluteEnd = findMatchingBracket(cleaned, absoluteStart);
      if (absoluteEnd < 0) break;
      valueEnd = absoluteEnd - bodyOffset + 1;
    } else if (startChar === "\"") {
      valueEnd += 1;
      let escapedString = false;
      while (valueEnd < body.length) {
        const char = body[valueEnd];
        if (escapedString) escapedString = false;
        else if (char === "\\") escapedString = true;
        else if (char === "\"") {
          valueEnd += 1;
          break;
        }
        valueEnd += 1;
      }
    } else {
      while (valueEnd < body.length && body[valueEnd] !== ",") valueEnd += 1;
    }
    const rawValueSnippet = body.slice(valueStart, valueEnd).trim();
    try {
      entries.push({ key, value: JSON.parse(rawValueSnippet), rawValueSnippet });
    } catch {}
    index = valueEnd;
  }
  return entries;
};

const scanJsonValueEnd = (input, startIndex) => {
  let index = startIndex;
  while (index < input.length && /\s/.test(input[index])) index += 1;
  if (index >= input.length) return index;
  const first = input[index];
  if (first === "{") return findMatchingBrace(input, index) + 1;
  if (first === "[") return findMatchingBracket(input, index) + 1;
  if (first === "\"") {
    let i = index + 1;
    let escaped = false;
    while (i < input.length) {
      const char = input[i];
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") return i + 1;
      i += 1;
    }
    return i;
  }
  let i = index;
  while (i < input.length && !/[,\]}]/.test(input[i])) i += 1;
  return i;
};

const extractRepeatedKeyValues = (raw, keyName) => {
  const cleaned = stripTrailingCommas(stripJsonComments(raw || ""));
  const marker = `"${keyName}"`;
  const values = [];
  let searchIndex = 0;
  while (searchIndex < cleaned.length) {
    const markerIndex = cleaned.indexOf(marker, searchIndex);
    if (markerIndex < 0) break;
    let index = markerIndex + marker.length;
    while (index < cleaned.length && /\s/.test(cleaned[index])) index += 1;
    if (cleaned[index] !== ":") {
      searchIndex = markerIndex + marker.length;
      continue;
    }
    index += 1;
    while (index < cleaned.length && /\s/.test(cleaned[index])) index += 1;
    const valueStart = index;
    const valueEnd = scanJsonValueEnd(cleaned, valueStart);
    const rawValueSnippet = cleaned.slice(valueStart, valueEnd).trim();
    try {
      values.push({ key: keyName, value: JSON.parse(rawValueSnippet), rawValueSnippet });
    } catch {}
    searchIndex = valueEnd;
  }
  return values;
};

const splitTopLevelObjects = (arrayBody) => {
  const objects = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < arrayBody.length; i += 1) {
    const current = arrayBody[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === "\"") inString = false;
      continue;
    }
    if (current === "\"") {
      inString = true;
      continue;
    }
    if (current === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (current === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(arrayBody.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
};

const extractFieldArrayEntries = (raw, fieldName) => {
  const cleaned = stripTrailingCommas(stripJsonComments(raw));
  const marker = `"${fieldName}"`;
  const markerIndex = cleaned.indexOf(marker);
  if (markerIndex < 0) return [];
  const arrayStart = cleaned.indexOf("[", markerIndex);
  if (arrayStart < 0) return [];
  const arrayEnd = findMatchingBracket(cleaned, arrayStart);
  if (arrayEnd < 0) return [];
  const arrayBody = cleaned.slice(arrayStart + 1, arrayEnd);
  return splitTopLevelObjects(arrayBody).map((snippet) => ({
    entry: parseJsoncText(snippet),
    rawSnippet: snippet,
    conditionEntries: extractRepeatedObjectEntries(snippet, "condition"),
    actionEntries: extractRepeatedObjectEntries(snippet, "action"),
    resultEntries: extractRepeatedObjectEntries(snippet, "result"),
  }));
};

const extractTopLevelObjectSnippet = (raw, key) => {
  const cleaned = raw || "";
  const marker = `"${key}"`;
  const markerIndex = cleaned.indexOf(marker);
  if (markerIndex < 0) return "";
  const braceStart = cleaned.indexOf("{", markerIndex);
  if (braceStart < 0) return "";
  const braceEnd = findMatchingBrace(cleaned, braceStart);
  if (braceEnd < 0) return "";
  return cleaned.slice(markerIndex, braceEnd + 1);
};

const card = (html) => {
  const article = document.createElement("article");
  article.className = "entry-card";
  article.innerHTML = html;
  return article;
};

const materialFromRare = (rare) => {
  const mapping = {
    1: { label: "岩石", className: "material material--rock" },
    2: { label: "青铜", className: "material material--bronze" },
    3: { label: "白银", className: "material material--silver" },
    4: { label: "黄金", className: "material material--gold" },
  };
  return mapping[rare] || { label: `品级 ${rare}`, className: "material material--rock" };
};

const createIndices = () => ({
  cards: new Map(siteData.cards.map((item) => [item.id, item])),
  rites: new Map(siteData.rites.map((item) => [item.id, item])),
  events: new Map(siteData.events.map((item) => [item.id, item])),
  endings: new Map(siteData.endings.map((item) => [item.id, item])),
  afterStory: new Map((siteData.afterStory || []).map((item) => [item.id, item])),
  quests: new Map((siteData.quests || []).map((item) => [item.id, item])),
});

const tutorialSudanIds = new Set([2000512, 2000513, 2000514, 2000515]);
const counterNameMap = translationData.counterNameMap || {};
const entityAliasMap = translationData.entityAliasMap || {};
const entityDisplayNameMap = translationData.entityDisplayNameMap || {};
const counterSpecialNameMap = translationData.counterSpecialNameMap || {};
const typeLabelMap = translationData.typeLabelMap || {
  char: "角色",
  item: "物品",
  sudan: "苏丹卡",
  monster: "怪物",
  army: "军队",
  TREASURE: "奇珍",
};
const tableStateMap = translationData.tableStateMap || {};
const actionTextMap = translationData.actionTextMap || {};
const getCommentDictionary = () => siteData?.commentDictionary || {};
const getCommentCounterMap = () => getCommentDictionary().counters || {};
const getCommentCardMap = () => getCommentDictionary().cards || {};
const getCommentRiteMap = () => getCommentDictionary().rites || {};
const getCommentEventMap = () => getCommentDictionary().events || {};
const getCommentRawKeyMap = () => getCommentDictionary().rawKeys || {};
const commentSourceKeyForItem = (item) => `${item?.kind || "entry"}:${item?.sourcePath || "unknown"}:${item?.id ?? "unknown"}`;

const ensureCommentDictionaryForItem = (item) => {
  if (!siteData || !item?.rawSource) return;
  const current = siteData.commentDictionary || createEmptyCommentDictionary();
  const sourceKey = commentSourceKeyForItem(item);
  if (current.extractedSources?.[sourceKey]) return;
  const patch = buildCommentDictionaryFromFileMap(new Map([[sourceKey, item.rawSource]]), current.sourceRoot || "");
  patch.extractedSources = { [sourceKey]: true };
  siteData.commentDictionary = mergeCommentDictionary(current, patch);
};

const ensureGlobalCounterCommentDictionary = () => {
  if (!siteData) return;
  const current = siteData.commentDictionary || createEmptyCommentDictionary();
  if (current.extractedSources?.__all_counter_sources__) return;
  const fileMap = new Map();
  [...(siteData.cards || []), ...(siteData.rites || []), ...(siteData.events || []), ...(siteData.endings || []), ...(siteData.afterStory || []), ...(siteData.quests || [])].forEach((item) => {
    if (!item?.rawSource) return;
    const sourceKey = commentSourceKeyForItem(item);
    fileMap.set(sourceKey, item.rawSource);
  });
  const patch = buildCommentDictionaryFromFileMap(fileMap, current.sourceRoot || "");
  patch.cards = {};
  patch.rites = {};
  patch.events = {};
  patch.extractedSources = { __all_counter_sources__: true };
  siteData.commentDictionary = mergeCommentDictionary(current, patch);
};

  const typeLabel = (value) => typeLabelMap[value] || value || "未标注";
  const gradeLabel = (item) => materialFromRare(item.rare).label;
  const formatTagTips = (tags = []) => (tags.length ? `检定：${tags.join("、")}` : "");
  const yesNo = (value) => (value ? "是" : "否");
  const formatEquips = (equips = []) => (equips.length ? equips.join("、") : "无");
  const hasReadableEntries = (entries) => Array.isArray(entries) && entries.length > 0;
const formatRiteAutoPills = (item) => `
  <span class="pill">等待回合: ${item.waitingRound}</span>
  <span class="pill">自动开始: ${yesNo(item.autoBegin)}</span>
  <span class="pill">自动结算: ${yesNo(item.autoResult)}</span>
`;
const formatCardVanishPills = (item) => {
  const pills = [];
  if (item.vanishDays > 0) {
    pills.push(`<span class="pill">寿命: ${item.vanishDays}</span>`);
  }
  if (item.vanishOver !== null && item.vanishOver !== undefined) {
    pills.push(`<span class="pill">超时结局: ${item.vanishOver}</span>`);
  }
  if (item.vanishEventIds?.length) {
    pills.push(`<span class="pill">到时事件: ${item.vanishEventIds.length}条</span>`);
  }
  if (item.vanishRiteIds?.length) {
    pills.push(`<span class="pill">到时仪式: ${item.vanishRiteIds.length}条</span>`);
  }
  return pills.join("");
};

const allEntries = () => [
  ...(siteData?.cards || []),
  ...(siteData?.rites || []),
  ...(siteData?.events || []),
  ...(siteData?.endings || []),
  ...(siteData?.afterStory || []),
  ...(siteData?.quests || []),
];

const normalizeImportPath = (value) => String(value || "").replaceAll("\\", "/").replace(/^\.?\//, "");
const hashString = (input) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const findLineCommentIndex = (line) => {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < line.length - 1; index += 1) {
    const current = line[index];
    const next = line[index + 1];
    if (inString) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === "\"") inString = false;
      continue;
    }
    if (current === "\"") {
      inString = true;
      continue;
    }
    if (current === "/" && next === "/") {
      return index;
    }
  }
  return -1;
};

const createEmptyCommentDictionary = (sourceRootPrefix = "") => ({
  generatedAt: new Date().toISOString(),
  sourceRoot: sourceRootPrefix,
  counters: {},
  cards: {},
  rites: {},
  events: {},
  rawKeys: {},
  extractedSources: {},
});

const buildCommentDictionaryFromFileMap = (fileMap, sourceRootPrefix = "") => {
  const dictionary = createEmptyCommentDictionary(sourceRootPrefix);

  const pushRawKey = (key, comment) => {
    if (!dictionary.rawKeys[key]) dictionary.rawKeys[key] = [];
    if (!dictionary.rawKeys[key].includes(comment)) dictionary.rawKeys[key].push(comment);
  };

  const setFirst = (bucket, key, comment) => {
    if (!bucket[key] && comment) bucket[key] = comment;
  };

  for (const [filePath, raw] of fileMap.entries()) {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const commentIndex = findLineCommentIndex(line);
      if (commentIndex < 0) continue;
      const before = line.slice(0, commentIndex).trim();
      const comment = line.slice(commentIndex + 2).trim();
      if (!before || !comment) continue;

      const keyMatch = before.match(/"([^"]+)"\s*:\s*(.+?)\s*,?$/);
      if (!keyMatch) continue;
      const [, rawKey, rawValue] = keyMatch;
      const trimmedValue = rawValue.trim();
      pushRawKey(rawKey, comment);

      const counterMatch = rawKey.match(/^(?:!?)(?:global_counter|counter)(?:[+\-=]|\.)(\d+)(?:[<>]=?|=)?$/);
      if (counterMatch) {
        setFirst(dictionary.counters, counterMatch[1], comment);
        continue;
      }

      const numericValueMatch = trimmedValue.match(/^(\d{6,7})$/);
      if (numericValueMatch) {
        const normalizedId = numericValueMatch[1];
        if (rawKey.includes("rite")) {
          setFirst(dictionary.rites, normalizedId, comment);
          continue;
        }
        if (rawKey.includes("event")) {
          setFirst(dictionary.events, normalizedId, comment);
          continue;
        }
        if (["is", "!is"].includes(rawKey) || /^s\d+\.is$/.test(rawKey)) {
          setFirst(dictionary.cards, normalizedId, comment);
          continue;
        }
      }

      if (/^\d{6,7}$/.test(rawKey)) {
        setFirst(dictionary.cards, rawKey, comment);
      }
    }
  }

  return dictionary;
};

const mergeCommentDictionary = (target, patch) => {
  const next = target || createEmptyCommentDictionary();
  if (!patch) return next;

  ["counters", "cards", "rites", "events"].forEach((bucketName) => {
    const bucket = patch[bucketName] || {};
    Object.entries(bucket).forEach(([key, value]) => {
      if (!next[bucketName][key] && value) next[bucketName][key] = value;
    });
  });

  const rawKeys = patch.rawKeys || {};
  Object.entries(rawKeys).forEach(([key, values]) => {
    if (!next.rawKeys[key]) next.rawKeys[key] = [];
    values.forEach((value) => {
      if (value && !next.rawKeys[key].includes(value)) next.rawKeys[key].push(value);
    });
  });

  next.extractedSources = {
    ...(next.extractedSources || {}),
    ...(patch.extractedSources || {}),
  };

  return next;
};

const fingerprintFileMap = (fileMap) => {
  const payload = [...fileMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
    .map(([path, content]) => `${path}\n${content.length}\n${content}`)
    .join("\n@@\n");
  return hashString(payload);
};

const fingerprintZipImport = (file) => hashString(`zip|${file.name}|${file.size}|${file.lastModified}`);

const fingerprintFolderImport = (files) =>
  hashString(
    `folder|${[...files]
      .map((file) => `${normalizeImportPath(file.webkitRelativePath || file.name)}|${file.size}|${file.lastModified}`)
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .join("\n")}`,
  );

const detectConfigRoot = (paths) => {
  const cardsPath = paths.find((item) => item.endsWith("/cards.json") || item === "cards.json");
  if (!cardsPath) return "";
  return cardsPath.endsWith("cards.json") ? cardsPath.slice(0, -10) : "";
};

const readDirectoryJsonFromMap = (fileMap, rootPrefix, dirName) =>
  [...fileMap.entries()]
    .filter(([filePath]) => filePath.startsWith(`${rootPrefix}${dirName}/`) && filePath.endsWith(".json"))
    .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
    .map(([filePath, raw]) => ({
      file: filePath.split("/").at(-1),
      path: filePath.slice(rootPrefix.length),
      raw,
      data: parseJsoncText(raw),
    }));

const collectIdsFromObject = (value, keyName, bucket) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIdsFromObject(item, keyName, bucket));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, nested]) => {
    if (key === keyName) {
      if (Array.isArray(nested)) {
        nested.forEach((item) => {
          if (typeof item === "number" || typeof item === "string") bucket.add(Number(item));
        });
      } else if (typeof nested === "number" || typeof nested === "string") {
        bucket.add(Number(nested));
      }
    }
    collectIdsFromObject(nested, keyName, bucket);
  });
};

const arrayFromNumberish = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter(Number.isFinite);
  }
  if (value === null || value === undefined || value === "") return [];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? [numeric] : [];
};

const collectPromptsFromObject = (value, bucket) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPromptsFromObject(item, bucket));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, nested]) => {
    if (key === "prompt" && nested) {
      if (typeof nested === "string") bucket.push(nested);
      else if (typeof nested === "object" && nested.text) bucket.push(String(nested.text));
    }
    collectPromptsFromObject(nested, bucket);
  });
};

const summarizeSlots = (slots = {}, rawSlotEntries = []) =>
  Object.entries(slots).map(([slotId, slot]) => {
    const rawSlotEntry = rawSlotEntries.find((entry) => entry.key === slotId);
    return {
    slotId,
    text: slot.text || "",
    condition: slot.condition || {},
    rawSnippet: rawSlotEntry?.rawValueSnippet || "",
    conditionEntries: rawSlotEntry ? extractRepeatedObjectEntries(rawSlotEntry.rawValueSnippet, "condition") : [],
    isKey: Boolean(slot.is_key),
    isEmptyAllowed: Boolean(slot.is_empty),
    openAdsorb: Boolean(slot.open_adsorb),
    isEnemy: Boolean(slot.is_enemy),
    };
  });

const buildSiteDataFromFileMap = (fileMap) => {
  const paths = [...fileMap.keys()];
  const rootPrefix = detectConfigRoot(paths);
  const requireFile = (relativePath) => {
    const raw = fileMap.get(`${rootPrefix}${relativePath}`);
    if (!raw) throw new Error(`缺少文件：${relativePath}`);
    return raw;
  };

  const cardsRaw = requireFile("cards.json");
  const cards = parseJsoncText(cardsRaw);
  const over = parseJsoncText(requireFile("over.json"));
  const overRaw = requireFile("over.json");
  const questRaw = requireFile("quest.json");
  const quest = parseJsoncText(questRaw);
  const riteFiles = readDirectoryJsonFromMap(fileMap, rootPrefix, "rite");
  const eventFiles = readDirectoryJsonFromMap(fileMap, rootPrefix, "event");
  const afterStoryFiles = readDirectoryJsonFromMap(fileMap, rootPrefix, "after_story");

  const cardEntries = Object.values(cards);
  const cardSummaries = cardEntries
    .map((cardItem) => {
      const rawSource = extractTopLevelObjectSnippet(cardsRaw, String(cardItem.id));
      return {
        kind: "cards",
        id: cardItem.id,
        name: cardItem.name,
        title: cardItem.title || "",
        text: cardItem.text || "",
        type: cardItem.type || "",
        rare: cardItem.rare ?? 0,
        tags: cardItem.tag || {},
        equips: cardItem.equips || [],
        postRiteEntries: extractFieldArrayEntries(rawSource, "post_rite"),
        vanishDays: cardItem.card_vanishing ?? 0,
        vanishEventIds: arrayFromNumberish(cardItem.vanish?.event_on),
        vanishRiteIds: arrayFromNumberish(cardItem.vanish?.rite),
        vanishOver: cardItem.vanish?.over ?? null,
        sourcePath: "cards.json",
        rawSource,
        raw: cardItem,
      };
    })
    .sort((a, b) => a.id - b.id);

    const riteSummaries = riteFiles.map(({ data, path: sourcePath, raw }) => {
      const prompts = [];
      const rawSlotEntries = extractRepeatedObjectEntries(raw, "cards_slot");
      const rawOpenConditionEntries = extractFieldArrayEntries(raw, "open_conditions");
      const { riteIds: nextRiteIds, eventIds: nextEventIds } = collectJumpIdBuckets(data, raw);
      collectPromptsFromObject(data, prompts);
    return {
      kind: "rites",
      id: data.id,
      name: data.name,
      text: data.text || "",
      type: data.type || "",
      icon: data.icon || "",
      location: data.location || "",
      mappingId: data.mapping_id ?? null,
      roundNumber: data.round_number ?? 0,
      waitingRound: data.waiting_round ?? 0,
      autoBegin: Boolean(data.auto_begin),
      autoResult: Boolean(data.auto_result),
      onceNew: Boolean(data.once_new),
      tipsText: data.tips_text || [],
      randomText: data.random_text || {},
      randomTextUp: data.random_text_up || {},
      tagTips: data.tag_tips || [],
      openConditions: (data.open_conditions || []).map((item, index) => ({
        condition: item.condition || {},
        tips: item.tips || "",
        conditionEntries: rawOpenConditionEntries[index]?.conditionEntries || [],
      })),
      slots: summarizeSlots(data.cards_slot, rawSlotEntries),
      slotCount: Object.keys(data.cards_slot || {}).length,
      settlementCount: Array.isArray(data.settlement) ? data.settlement.length : 0,
      settlementExtreCount: Array.isArray(data.settlement_extre) ? data.settlement_extre.length : 0,
      settlementPriorCount: Array.isArray(data.settlement_prior) ? data.settlement_prior.length : 0,
      nextEventIds,
      nextRiteIds,
      prompts: [...new Set(prompts)].slice(0, 6),
      sourcePath,
      settlementEntries: extractFieldArrayEntries(raw, "settlement"),
      settlementExtreEntries: extractFieldArrayEntries(raw, "settlement_extre"),
      settlementPriorEntries: extractFieldArrayEntries(raw, "settlement_prior"),
      waitingRoundEndEntries: extractFieldArrayEntries(raw, "waiting_round_end_action"),
      rawSource: raw,
      raw: data,
    };
  });

    const eventSummaries = eventFiles.map(({ data, path: sourcePath, raw }) => {
      const prompts = [];
      const { riteIds: nextRiteIds, eventIds: nextEventIds } = collectJumpIdBuckets(data, raw);
      collectPromptsFromObject(data, prompts);
    return {
      kind: "events",
      id: data.id,
      text: data.text || "",
      on: data.on || {},
      onEntries: extractRepeatedObjectEntries(raw, "on"),
      condition: data.condition || {},
      conditionEntries: extractRepeatedObjectEntries(raw, "condition"),
      isReplay: Boolean(data.is_replay),
      autoStart: Boolean(data.auto_start),
      startTrigger: Boolean(data.start_trigger),
      settlementCount: Array.isArray(data.settlement) ? data.settlement.length : 0,
      settlementExtreCount: Array.isArray(data.settlement_extre) ? data.settlement_extre.length : 0,
      nextEventIds,
      nextRiteIds,
      prompts: [...new Set(prompts)].slice(0, 6),
      sourcePath,
      settlementEntries: extractFieldArrayEntries(raw, "settlement"),
      settlementExtreEntries: extractFieldArrayEntries(raw, "settlement_extre"),
      settlementPriorEntries: extractFieldArrayEntries(raw, "settlement_prior"),
      waitingRoundEndEntries: extractFieldArrayEntries(raw, "waiting_round_end_action"),
      rawSource: raw,
      raw: data,
    };
  });

  const endingSummaries = Object.entries(over)
    .map(([id, value]) => ({
      kind: "endings",
      id: Number(id),
      name: value.name || "",
      subName: value.sub_name || "",
      text: value.text || "",
      openAfterStory: Boolean(value.open_after_story),
      sourcePath: "over.json",
      raw: value,
      rawSource: extractTopLevelObjectSnippet(overRaw, id),
      textExtra: Array.isArray(value.text_extra) ? value.text_extra : [],
      textExtraEntries: extractFieldArrayEntries(extractTopLevelObjectSnippet(overRaw, id), "text_extra"),
    }))
    .sort((a, b) => a.id - b.id);

  const questSummaries = Object.values(quest)
    .map((questItem) => {
      const rawSource = extractTopLevelObjectSnippet(questRaw, String(questItem.id));
      return {
        kind: "quests",
        id: questItem.id,
        name: questItem.name || "",
        text: questItem.text || "",
        favourText: questItem.favour_text || "",
        upgradePoint: questItem.upgrade_point ?? 0,
        pre: questItem.pre ?? 0,
        target: Array.isArray(questItem.target) ? questItem.target : [],
        targetEntries: extractFieldArrayEntries(rawSource, "target"),
        icon: questItem.icon || "",
        sourcePath: "quest.json",
        rawSource,
        raw: questItem,
      };
    })
    .sort((a, b) => a.id - b.id);

  return {
    generatedAt: new Date().toISOString(),
    commentDictionary: createEmptyCommentDictionary(rootPrefix),
    summary: {
      totalCardCount: cardSummaries.length,
      riteCount: riteSummaries.length,
      eventCount: eventSummaries.length,
      endingCount: endingSummaries.length,
      afterStoryCount: afterStoryFiles.length,
      questCount: questSummaries.length,
      initModeCount: 0,
    },
    cards: cardSummaries,
    rites: riteSummaries,
    events: eventSummaries,
    endings: endingSummaries,
    quests: questSummaries,
    afterStory: afterStoryFiles.map(({ data, path: sourcePath, raw }) => ({
      kind: "afterStory",
      id: data.id,
      name: data.name || "",
      text: "",
      sourcePath,
      raw: data,
      rawSource: raw,
      closeCondition: data.close_condition || {},
      closeConditionEntries: extractRepeatedObjectEntries(raw, "close_condition"),
      prior: Array.isArray(data.prior) ? data.prior : [],
      priorEntries: extractFieldArrayEntries(raw, "prior"),
      extra: Array.isArray(data.extra) ? data.extra : [],
      extraEntries: extractFieldArrayEntries(raw, "extra"),
      extraCount: Array.isArray(data.extra) ? data.extra.length : 0,
    })),
  };
};

const jumpTo = (tab, id) => {
  const tabButton = tabs.find((node) => node.dataset.target === tab);
  if (!tabButton) return;
  tabs.forEach((node) => node.classList.remove("is-active"));
  tabButton.classList.add("is-active");
  currentTab = tab;
  selectedKey = `${tab}:${Number(id)}`;
  searchInput.value = "";
  if (currentTab !== "cards") {
    currentCardFilter = "all";
    cardSubtabsButtons.forEach((node) => node.classList.toggle("is-active", node.dataset.cardFilter === "all"));
  }
  if (currentTab !== "rites") {
    currentRiteFilter = "all";
    riteSubtabsButtons.forEach((node) => node.classList.toggle("is-active", node.dataset.riteFilter === "all"));
  }
  renderExplorer();
};

const renderJumpList = (items, tab, { preview = false } = {}) => {
  if (!items || items.length === 0) {
    return `<div class="muted">无</div>`;
  }
  return `<div class="jump-list">${items
    .map(
      (item) =>
        `<button class="jump" data-tab="${tab}" data-id="${item.id}"${preview ? ` data-preview="${tab.slice(0, -1)}"` : ""}>${escapeHtml(item.label)}</button>`,
    )
    .join("")}</div>`;
};

const collectJumpItems = (ids, tab, formatter) =>
  (ids || [])
    .map((id) => {
      const target = indices[tab].get(Number(id));
      if (!target) return null;
      return {
        id: Number(id),
        label: formatter(target),
      };
    })
    .filter(Boolean);

const collectNumericRefs = (value, refs = new Set()) => {
    if (Array.isArray(value)) {
      value.forEach((item) => collectNumericRefs(item, refs));
      return refs;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      refs.add(value);
      return refs;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      refs.add(Number(value));
      return refs;
    }
    if (!value || typeof value !== "object") {
      return refs;
    }
  Object.entries(value).forEach(([key, nested]) => {
    const keyNumber = Number(key);
    if (Number.isFinite(keyNumber) && keyNumber >= 2000000) {
      refs.add(keyNumber);
    }
    if (typeof nested === "number" && nested >= 2000000) {
      refs.add(nested);
    }
    collectNumericRefs(nested, refs);
  });
  return refs;
};

const collectCardRefsFromKeys = (value, refs = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCardRefsFromKeys(item, refs));
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  Object.entries(value).forEach(([key, nested]) => {
    const stateMatch = key.match(/^(?:!?)(?:have|table_have|hand_have)\.([^.]+)(?:\.|$)/);
    if (stateMatch) {
      const target = resolveCardTargetByToken(stateMatch[1]);
      if (target) refs.add(target.id);
    }

    if (key.match(/^s\d+\+equip$/)) {
      const target = resolveCardTargetByToken(nested);
      if (target) refs.add(target.id);
    }

    const slotFieldMatch = key.match(/^s\d+\.([^.]+)$/);
    if (slotFieldMatch) {
      const target = resolveCardTargetByToken(slotFieldMatch[1]);
      if (target) refs.add(target.id);
    }

    const tableIdMatch = key.match(/^table\.(\d+)(?:[+\-.]|$)/);
    if (tableIdMatch) {
      const target = resolveCardTargetByToken(tableIdMatch[1]);
      if (target) refs.add(target.id);
    }

    collectCardRefsFromKeys(nested, refs);
  });
  return refs;
};

const collectConditionCardRefs = (value) => {
  const refIds = new Set([...collectNumericRefs(value), ...collectCardRefsFromKeys(value)]);
  return [...refIds]
    .map((id) => {
      const target = indices.cards.get(Number(id));
      return target ? { id: Number(id), label: `${id} · ${target.name}` } : null;
    })
    .filter(Boolean);
};

const collectCounterRefs = (value, refs = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCounterRefs(item, refs));
    return refs;
  }
  if (!value || typeof value !== "object") {
    return refs;
  }
  Object.entries(value).forEach(([key, nested]) => {
    const counterMatch = key.match(/^(?:!?)(?:global_counter|counter)(?:[+\-=]|\.)(\d+)(?:[<>]=?|=)?$/);
    if (counterMatch) {
      refs.add(counterMatch[1]);
    }
    collectCounterRefs(nested, refs);
  });
  return refs;
};

const resolveCounterLabel = (id) =>
  counterSpecialNameMap[String(id)] || counterNameMap[String(id)] || getCommentCounterMap()[String(id)] || "";

const fixedCounterIds = new Set(["7100001", "7100002", "7100003", "7100004", "7100005"]);

const collectCounterRefDetailsFromRaw = (rawSource) => {
  if (!rawSource) return new Map();
  const detailMap = new Map();
  const seen = new Set();
  const regex = /"((?:!?)(?:global_counter|counter)([+\-=\.])(\d+)([<>]=?|=)?)"\s*:\s*([^,\r\n}]+)/g;
  for (const match of rawSource.matchAll(regex)) {
    const [_, rawKey, separator, id, comparisonOperator = "", rawValue = ""] = match;
    const commentIndex = findLineCommentIndex(rawValue);
    const valueOnly = commentIndex >= 0 ? rawValue.slice(0, commentIndex) : rawValue;
    const trimmedValue = valueOnly.trim().replace(/,$/, "");
    const caseKey = `${rawKey}:${trimmedValue}`;
    if (seen.has(caseKey)) continue;
    seen.add(caseKey);
    if (!detailMap.has(id)) detailMap.set(id, []);
    detailMap.get(id).push({
      rawKey,
      separator,
      comparisonOperator,
      value: trimmedValue,
      comment: getCommentRawKeyMap()[rawKey]?.[0] || "",
    });
  }
  return detailMap;
};

const counterPreviewContexts = new Map();
let counterPreviewSeq = 0;

const registerCounterPreviewContext = (counterId, rawSource = "") => {
  const normalizedId = String(counterId || "").trim();
  if (!/^\d+$/.test(normalizedId)) return "";
  const token = `counter:${counterPreviewSeq += 1}`;
  counterPreviewContexts.set(token, {
    counterId: normalizedId,
    rawSource: String(rawSource || ""),
  });
  return token;
};

const counterJumpHtml = (counterId, label, rawSource = "") => {
  const token = registerCounterPreviewContext(counterId, rawSource);
  const text = escapeHtml(label);
  if (!token) return text;
  return `<button class="jump jump--inline" data-preview="counter" data-counter-token="${token}" aria-label="查看计数器说明：${escapeHtml(label)}">${text}</button>`;
};

const formatCounterCaseText = ({ separator, comparisonOperator, value }) => {
  const readableValue = escapeHtml(valueToReadableText(value));
  if (separator === "+") return `+${readableValue}`;
  if (separator === "-") return `-${readableValue}`;
  if (separator === "=") return `=${readableValue}`;
  if (comparisonOperator) return `${comparisonOperator}${readableValue}`;
  return `：${readableValue}`;
};

const renderCounterCaseLine = (item) =>
  `<div class="readable-meta">${formatCounterCaseText(item)}（${escapeHtml(item.comment || "无注释")}）</div>`;

const renderSingleCounterReferenceHtml = (id, rawSource = "") => {
  ensureGlobalCounterCommentDictionary();
  const normalizedId = String(id);
  const label = resolveCounterLabel(normalizedId);
  const cases = fixedCounterIds.has(normalizedId) ? [] : (collectCounterRefDetailsFromRaw(rawSource).get(normalizedId) || []);

  return `
    <div class="detail-pane__header">
      <h3>计数器 #${escapeHtml(normalizedId)}</h3>
      <div class="entry-card__meta">解析自注释，仅供参考</div>
    </div>
    <div class="detail-pane__section">
      <div class="detail-pane__kv">
        <div class="detail-pane__card">
          <strong>基础信息</strong>
          ${renderKvRowsHtml([
            ["ID", `#${escapeHtml(normalizedId)}`],
            ["名称", escapeHtml(label || "未整理")],
            ...(cases.length
              ? [[
                  "注释对照",
                  `<div class="detail-sublist">
                    ${cases
                      .map(
                        (item) => renderCounterCaseLine(item),
                      )
                      .join("")}
                  </div>`,
                ]]
              : []),
          ])}
        </div>
      </div>
    </div>
  `;
};

const renderCounterReferenceSection = (ids, rawSource = "") => {
  if (!ids?.length) return "";
  ensureGlobalCounterCommentDictionary();
  const detailMap = collectCounterRefDetailsFromRaw(rawSource);
  return `
      <details class="detail-pane__section">
        <summary>这条配置里提到的计数器</summary>
        <div>${wrapScrollableSection(`
          <div class="readable-list">
            <div class="readable-item">
              <strong>计数器对照（解析自注释，仅供参考）</strong>
              <div class="kv-list">
                ${ids
                  .map((id) => {
                    const label = resolveCounterLabel(id);
                    const cases = fixedCounterIds.has(String(id)) ? [] : (detailMap.get(String(id)) || []);
                    return `
                      <div class="kv-row">
                        <dt>${counterJumpHtml(id, `#${String(id)}`, rawSource)}</dt>
                      <dd>
                        <div>${escapeHtml(label || "未整理")}</div>
                        ${
                          cases.length
                            ? `<div class="detail-sublist">${cases
                                .map(
                                  (item) => renderCounterCaseLine(item),
                                )
                                .join("")}</div>`
                            : ""
                        }
                      </dd>
                    </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        `)}</div>
      </details>
    `;
};

const renderCounterPreviewHtml = (token) => {
  const context = counterPreviewContexts.get(String(token || ""));
  if (!context?.counterId) return "";
  return renderSingleCounterReferenceHtml(context.counterId, context.rawSource);
};

const textOrDash = (value) => {
  if (value === undefined || value === null || value === "") return "无";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
};

const valueToReadableText = (value) => {
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => valueToReadableText(item)).join(" / ") : "无";
  }
  if (value && typeof value === "object") {
    const pairs = Object.entries(value).map(([key, nested]) => `${key}: ${valueToReadableText(nested)}`);
    return pairs.length ? pairs.join("；") : "无";
  }
  return textOrDash(value);
};

const renderKvRows = (pairs) =>
  `<dl class="kv-list">${pairs
    .map(
      ([label, value]) => `
        <div class="kv-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(textOrDash(value))}</dd>
        </div>`,
    )
    .join("")}</dl>`;

const renderKvRowsHtml = (pairs) =>
  `<dl class="kv-list">${pairs
    .map(
      ([label, value]) => `
        <div class="kv-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${value || "无"}</dd>
        </div>`,
    )
    .join("")}</dl>`;

const renderReadableEntries = (entries, formatter) => {
  if (!entries || entries.length === 0) {
    return `<div class="muted">无</div>`;
  }
  return `<div class="readable-list">${entries.map((entry, index) => formatter(entry, index)).join("")}</div>`;
};

const cardJumpHtml = (id, label) =>
  `<button class="jump jump--inline" data-tab="cards" data-id="${id}" data-preview="card">${escapeHtml(label)}</button>`;
const riteJumpHtml = (id, label) =>
  `<button class="jump jump--inline" data-tab="rites" data-id="${id}" data-preview="rite">${escapeHtml(label)}</button>`;
const eventJumpHtml = (id, label) =>
  `<button class="jump jump--inline" data-tab="events" data-id="${id}" data-preview="event">${escapeHtml(label)}</button>`;
const endingJumpHtml = (id, label) =>
  `<button class="jump jump--inline" data-tab="endings" data-id="${id}" data-preview="ending">${escapeHtml(label)}</button>`;
const normalizeQuestRefId = (rawId) => {
  const id = Number(rawId);
  if (!Number.isFinite(id)) return null;
  if (indices?.quests?.has(id)) return id;
  if (String(id).startsWith("32")) {
    const upgradedId = id + 100000;
    if (indices?.quests?.has(upgradedId)) return upgradedId;
  }
  return id;
};

const questJumpHtml = (id, label) => {
  const normalizedId = normalizeQuestRefId(id);
  if (!Number.isFinite(normalizedId)) return escapeHtml(label);
  return `<button class="jump jump--inline" data-tab="quests" data-id="${normalizedId}" data-preview="quest">${escapeHtml(label)}</button>`;
};

const findQuestById = (rawId) => {
  const normalizedId = normalizeQuestRefId(rawId);
  if (!Number.isFinite(normalizedId)) return null;
  const indexed = indices?.quests?.get(Number(normalizedId));
  if (indexed) return indexed;
  return siteData?.quests?.find((item) => Number(item.id) === Number(normalizedId)) || null;
};

const resolveRiteName = (id) => indices?.rites?.get(Number(id))?.name || getCommentRiteMap()[String(id)] || `ID ${id}`;
const resolveEventName = (id) => indices?.events?.get(Number(id))?.text || getCommentEventMap()[String(id)] || `ID ${id}`;
const resolveEndingName = (id) => indices?.endings?.get(Number(id))?.name || `ID ${id}`;
const resolveQuestName = (id) => findQuestById(id)?.name || `ID ${id}`;
const resolveQuestLabel = (id) => {
  const quest = findQuestById(id);
  const normalizedId = quest ? Number(quest.id) : normalizeQuestRefId(id);
  if (!Number.isFinite(normalizedId)) return `ID ${id}`;
  return `${normalizedId} · ${quest?.name || resolveQuestName(normalizedId)}`;
};
const resolveQuestShortLabel = (id) => findQuestById(id)?.name || resolveQuestName(id);
const findCardById = (rawId) => {
  const id = Number(rawId);
  if (!Number.isFinite(id)) return null;
  const indexed = indices?.cards?.get(id);
  if (indexed) return indexed;
  return siteData?.cards?.find((item) => Number(item.id) === id) || null;
};

const resolveCardName = (id) => {
  const target = findCardById(id);
  return target?.name || entityDisplayNameMap[Number(id)] || getCommentCardMap()[String(id)] || `ID ${id}`;
};

const resolveCardTargetByToken = (rawToken) => {
  const token = String(rawToken).trim();
  const aliasId = entityAliasMap[token];
  if (aliasId) {
    const aliasTarget = findCardById(aliasId);
    if (aliasTarget) return aliasTarget;
  }
  const numericId = Number(token);
  if (Number.isFinite(numericId)) {
    const numericTarget = findCardById(numericId);
    if (numericTarget) return numericTarget;
  }
  return (
    siteData?.cards?.find((item) => item.name === token) ||
    null
  );
};

const entityRefHtml = (rawToken) => {
  const token = String(rawToken).trim();
  const numericId = Number(token);
  if (Number.isFinite(numericId)) {
    const numericTarget = findCardById(numericId);
    if (numericTarget) {
      return cardJumpHtml(numericTarget.id, numericTarget.name);
    }
  }
  const target = resolveCardTargetByToken(token);
  if (target) {
    return cardJumpHtml(target.id, target.name);
  }
  return `<strong>${escapeHtml(token)}</strong>`;
};

const entityLabelHtml = (rawId) => {
  const normalized = String(rawId).trim();
  const id = Number(normalized);
  if (Number.isFinite(id)) {
    const numericTarget = findCardById(id);
    if (numericTarget) {
      return cardJumpHtml(numericTarget.id, numericTarget.name);
    }
  }
  const target = resolveCardTargetByToken(normalized);
  if (target) {
    return cardJumpHtml(target.id, target.name);
  }
  return escapeHtml(normalized);
};

const noWrapHtml = (content) => `<span class="inline-nowrap">${content}</span>`;

const choiceSpeakerHtml = (rawKey) => {
  const parts = String(rawKey).split(".");
  const speaker = parts.at(-1) || rawKey;
  return entityRefHtml(speaker);
};

const popSpeakerHtml = (rawKey) => choiceSpeakerHtml(rawKey);
const speakerTokenFromKey = (rawKey) => String(rawKey).split(".").at(-1) || String(rawKey);

const readableCounterName = (name) => {
  const label = counterNameMap[name] || getCommentCounterMap()[String(name)];
  if (/^\d+$/.test(String(name))) {
    return `#${name}`;
  }
  if (label) return `${name}（${label}）`;
  return String(name).replaceAll("_", " ");
};

const renderCounterDisplayHtml = (scope, name, rawSource = "") => {
  const scopeLabel = scope === "global_counter" ? "全局计数器" : "计数器";
  const stringName = String(name);
  if (/^\d+$/.test(stringName)) {
    return counterJumpHtml(stringName, `${scopeLabel} #${stringName}`, rawSource);
  }
  return `${scopeLabel} ${escapeHtml(readableCounterName(name))}`;
};

const renderQuestShowCounterHtml = (showCounter, rawSource = "") => {
  const rawValue = String(showCounter || "").trim();
  const match = rawValue.match(/^(global_counter|counter)\.(\d+)$/);
  if (!match) return escapeHtml(rawValue);
  const [, scope, counterId] = match;
  return renderCounterDisplayHtml(scope, counterId, rawSource);
};

const counterRuleText = (scope, name, operator, value, rawSource = "") => {
  const scopeLabel = scope === "global_counter" ? "全局计数器" : "计数器";
  const stringName = String(name);
  const readableValue = valueToReadableText(value);
  if (/^\d+$/.test(stringName)) {
    return `${counterJumpHtml(stringName, `${scopeLabel} #${stringName}`, rawSource)}${operator || "="}${escapeHtml(readableValue)}`;
  }
  return `${scopeLabel} ${readableCounterName(name)}${operator || "="}${readableValue}`;
};

const tableHaveRangeLabel = (name) => {
  if (name === "打包的财物") return "打包财物";
  return name;
};

const tableHaveCountText = (name, operator, value) => {
  const readableValue = valueToReadableText(value);
  return `${name}人数${operator === "=" ? "＝" : operator}${readableValue}`;
};

const tableHaveStateText = (name) => {
  if (tableStateMap[name]) return tableStateMap[name];
  return `${name}闲置`;
};

const staticActionText = (key) => actionTextMap[key] || "";

const promptValueText = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.text) return String(value.text);
    return "";
  }
  return valueToReadableText(value);
};

const isImplicitMutationValue = (value) => value === 1 || value === true || value === null || value === undefined;
const mutationValueSuffix = (value, { text = valueToReadableText(value), keepImplicit = false } = {}) =>
  (isImplicitMutationValue(value) && !keepImplicit) || text === "" ? "" : `：${escapeHtml(text)}`;

const normalizeMutationEntries = (action = {}) =>
  Array.isArray(action) ? action : Object.entries(action || {}).map(([key, value]) => ({ key, value }));

const mergeMutationEntries = (rawEntries = [], parsedObject = {}) => {
  const parsedEntries = normalizeMutationEntries(parsedObject);
  if (!rawEntries?.length) return parsedEntries;
  const existingKeys = new Set(rawEntries.map((entry) => entry.key));
  return [...rawEntries, ...parsedEntries.filter((entry) => !existingKeys.has(entry.key))];
};

const renderChoiceBubbleBlocks = (resultEntries = [], actionEntries = []) => {
  const allEntries = [...(resultEntries || []), ...(actionEntries || [])];
  const groups = new Map();
  const order = [];

  const ensureGroup = (speakerKey) => {
    if (!groups.has(speakerKey)) {
      groups.set(speakerKey, {
        speakerKey,
        speakerHtml: choiceSpeakerHtml(speakerKey),
        chooseTexts: [],
        bubbleTexts: [],
      });
      order.push(speakerKey);
    }
    return groups.get(speakerKey);
  };

  allEntries.forEach(({ key, value }) => {
    if (key === "choose" && value && typeof value === "object") {
      Object.entries(value).forEach(([choiceKey, choiceText]) => {
        if (typeof choiceText !== "string") return;
        const speakerKey = speakerTokenFromKey(choiceKey);
        ensureGroup(speakerKey).chooseTexts.push(String(choiceText));
      });
      return;
    }

    if (key.startsWith("pop.") || key.startsWith("think_pop.")) {
      const speakerKey = speakerTokenFromKey(key);
      ensureGroup(speakerKey).bubbleTexts.push(valueToReadableText(value));
    }
  });

  if (!order.length) return "";

  const hasBubbleTexts = order.some(
    (speakerKey) => groups.get(speakerKey).bubbleTexts.length || groups.get(speakerKey).chooseTexts.length,
  );
  const blocks = [];
  if (hasBubbleTexts) {
    blocks.push(
      `<div class="readable-meta">以下需要仪式中有对应卡牌时，于结算时每有一张符合条件的卡牌就触发一条对应人物的气泡。</div>`,
    );
  }
  order.forEach((speakerKey) => {
    const group = groups.get(speakerKey);
    if (group.chooseTexts.length || group.bubbleTexts.length) {
      blocks.push(`<div class="readable-meta">选择</div>`);
    }
    group.chooseTexts.forEach((text) => {
      blocks.push(`<div class="readable-meta detail-sublist">弹出提示：${group.speakerHtml}：“${escapeHtml(text)}”</div>`);
    });
    group.bubbleTexts.forEach((text) => {
      blocks.push(`<div class="readable-meta detail-sublist">弹出提示：${group.speakerHtml}：“${escapeHtml(text)}”</div>`);
    });
  });

  return blocks.join("");
};

const renderChoiceActionBlocks = (resultEntries = [], actionEntries = []) => {
  const allEntries = [...(resultEntries || []), ...(actionEntries || [])];
  const blocks = [];

  allEntries.forEach(({ key, value }) => {
    if (key !== "choose" || !value || typeof value !== "object") return;
    const optionEntries = Object.entries(value)
      .filter(([, optionValue]) => typeof optionValue !== "string")
      .map(([optionKey, optionValue]) => ({ key: optionKey, value: optionValue }));

    if (!optionEntries.length) return;

    blocks.push(`<div class="readable-meta"><strong>随机选择一项</strong></div>`);
    const optionLines = summarizeMutationEntries(optionEntries, "结果");
    if (optionLines.length) {
      blocks.push(
        optionLines
          .map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^结果：/, "")}</div>`)
          .join(""),
      );
    } else {
      blocks.push(`<div class="readable-meta detail-sublist">无额外效果</div>`);
    }
  });

  return blocks.join("");
};

const renderOptionCaseBlocks = (actionEntries = []) => {
  const optionEntry = actionEntries.find(({ key, value }) => key === "option" && value && typeof value === "object");
  const caseEntries = actionEntries.filter(({ key, value }) => /^case:op\d+$/.test(key) && value && typeof value === "object");
  if (!optionEntry && !caseEntries.length) return "";

  const optionItems = Array.isArray(optionEntry?.value?.items) ? optionEntry.value.items : [];
  const optionTextByTag = new Map(
    optionItems
      .filter((item) => item && typeof item === "object" && item.tag)
      .map((item) => [String(item.tag), String(item.text || "")]),
  );

  const blocks = [];
  if (optionEntry?.value) {
    const optionValue = optionEntry.value;
    blocks.push(`<div class="readable-meta"><strong>分支选项</strong></div>`);
    if (optionValue.text) {
      blocks.push(`<div class="readable-meta detail-sublist">文本：${renderRichText(optionValue.text)}</div>`);
    }
    optionItems.forEach((item) => {
      const tag = item?.tag ? String(item.tag) : "未命名";
      const text = item?.text ? String(item.text) : "";
      blocks.push(`<div class="readable-meta detail-sublist">选项 ${escapeHtml(tag)}：${renderRichText(text || "无文本")}</div>`);
    });
  }

  caseEntries.forEach(({ key, value }) => {
    const tag = key.split(":")[1];
    const optionText = optionTextByTag.get(tag);
    const caseValue = value && typeof value === "object" ? value : {};
    const promptText = caseValue.prompt && typeof caseValue.prompt === "object" ? promptValueText(caseValue.prompt) : "";
    const caseActions = { ...caseValue };
    delete caseActions.prompt;
    const caseLines = summarizeMutationEntries(caseActions, "结果");

    blocks.push(`<div class="readable-meta"><strong>分支 ${escapeHtml(tag)}${optionText ? `：${renderRichText(optionText)}` : ""}</strong></div>`);
    if (promptText) {
      blocks.push(`<div class="readable-meta detail-sublist">文本：${renderRichText(promptText)}</div>`);
    }
    if (caseLines.length) {
      blocks.push(
        caseLines
          .map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^结果：/, "")}</div>`)
          .join(""),
      );
    } else {
      blocks.push(`<div class="readable-meta detail-sublist">无额外效果</div>`);
    }
  });

  return blocks.join("");
};

const renderConfirmActionBlock = (value, allEntries, prefix) => {
  const confirmValue = value && typeof value === "object" ? value : {};
  const successEntry = allEntries.find((entry) => entry.key === "success");
  const failedEntry = allEntries.find((entry) => entry.key === "failed");
  const rawSuccessEntries = successEntry?.rawValueSnippet ? extractObjectEntriesFromSnippet(successEntry.rawValueSnippet) : [];
  const rawFailedEntries = failedEntry?.rawValueSnippet ? extractObjectEntriesFromSnippet(failedEntry.rawValueSnippet) : [];
  const parsedSuccess = successEntry?.value && typeof successEntry.value === "object" ? successEntry.value : {};
  const parsedFailed = failedEntry?.value && typeof failedEntry.value === "object" ? failedEntry.value : {};
  const successLines = summarizeMutationEntries(mergeMutationEntries(rawSuccessEntries, parsedSuccess), "结果", successEntry?.rawValueSnippet || "");
  const failedLines = summarizeMutationEntries(mergeMutationEntries(rawFailedEntries, parsedFailed), "结果", failedEntry?.rawValueSnippet || "");
  const blocks = [];

  if (confirmValue.text) {
    blocks.push(`<div class="readable-meta"><strong>${prefix}</strong></div>`);
    blocks.push(`<div class="readable-meta detail-sublist">文本：${renderRichText(confirmValue.text)}</div>`);
  }

  if (confirmValue.confirm_text || confirmValue.cancel_text) {
    const rows = [];
    if (confirmValue.confirm_text) rows.push(`确认文本：${renderRichText(confirmValue.confirm_text)}`);
    if (confirmValue.cancel_text) rows.push(`取消文本：${renderRichText(confirmValue.cancel_text)}`);
    blocks.push(`<div class="readable-meta detail-sublist">${rows.join("<br>")}</div>`);
  }

  if (successLines.length) {
    blocks.push(`<div class="readable-meta detail-sublist"><strong>确认后</strong></div>`);
    blocks.push(successLines.map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^结果：/, "")}</div>`).join(""));
  }

  if (failedLines.length) {
    blocks.push(`<div class="readable-meta detail-sublist"><strong>取消后</strong></div>`);
    blocks.push(failedLines.map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^结果：/, "")}</div>`).join(""));
  }

  return blocks.join("");
};

const summarizeMutationEntries = (action = {}, prefix = "动作", rawSource = "") => {
  const entries = [];
  const actionEntries = normalizeMutationEntries(action);

  const mutationRuleHandlers = [
    {
      match: ({ key }) => key === "rite",
      apply: ({ value }) => {
        const ids = collectIdsFromValue(value);
        return `${prefix}：出现仪式：${ids.map((id) => riteJumpHtml(id, resolveRiteName(id))).join(" / ")}`;
      },
    },
    {
      match: ({ key }) => key === "event_on",
      apply: ({ value }) => {
        const ids = collectIdsFromValue(value);
        return `${prefix}：出现事件：${ids.map((id) => eventJumpHtml(id, resolveEventName(id))).join(" / ")}`;
      },
    },
      {
        match: ({ key }) => key === "over",
        apply: ({ value }) => {
          const ids = collectIdsFromValue(value);
          return `${prefix}：进入结局：${ids.map((id) => endingJumpHtml(id, resolveEndingName(id))).join(" / ")}`;
        },
      },
      {
        match: ({ key }) => key === "confirm",
        apply: (entry) => renderConfirmActionBlock(entry.value, actionEntries, prefix),
      },
      {
        match: ({ key }) => key === "card",
        apply: ({ value }) => {
        if (Array.isArray(value) && value.length) {
          const [first, ...rest] = value;
          const label =
            typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))
              ? cardJumpHtml(Number(first), resolveCardName(Number(first)))
              : escapeHtml(valueToReadableText(first));
          const suffix = rest.length ? ` ${escapeHtml(rest.map((item) => valueToReadableText(item)).join(" "))}` : "";
          return `${prefix}：获得卡牌：${label}${suffix}`;
        }
        const ids = collectIdsFromValue(value);
        if (ids.length) {
          return `${prefix}：获得卡牌：${ids.map((id) => cardJumpHtml(id, resolveCardName(id))).join(" / ")}`;
        }
        return `${prefix}：获得卡牌：${escapeHtml(valueToReadableText(value))}`;
      },
    },
    {
      match: ({ key }) => /^(global_counter|counter)([+-])(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, scope, op, name] = key.match(/^(global_counter|counter)([+-])(.+)$/);
        return `${prefix}：${renderCounterDisplayHtml(scope, name, rawSource)} ${op === "+" ? "增加" : "减少"} ${valueToReadableText(value)}`;
      },
    },
    {
      match: ({ key }) => /^(global_counter|counter)=(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, scope, name] = key.match(/^(global_counter|counter)=(.+)$/);
        return `${prefix}：${renderCounterDisplayHtml(scope, name, rawSource)} 设为 ${valueToReadableText(value)}`;
      },
    },
    {
      match: ({ key }) => /^total\.(.+?)([+\-=])(.+)$/.test(key),
      apply: ({ key }) => {
        const [, target, op, mark] = key.match(/^total\.(.+?)([+\-=])(.+)$/);
        const opLabel = op === "+" ? "增加标记" : op === "-" ? "移除标记" : "设定标记";
        return `${prefix}：${entityLabelHtml(target)} ${opLabel}：${escapeHtml(mark)}`;
      },
    },
    {
      match: ({ key, value }) => key === "choose" && value && typeof value === "object",
      apply: () => null,
    },
    {
      match: ({ key, value }) => key === "option" && value && typeof value === "object",
      apply: () => null,
    },
    {
      match: ({ key, value }) => /^case:op\d+$/.test(key) && value && typeof value === "object",
      apply: () => null,
    },
    {
      match: ({ key }) => key === "event_off",
      apply: ({ value }) => {
        const ids = collectIdsFromValue(value);
        return `${prefix}：关闭事件：${ids.map((id) => eventJumpHtml(id, resolveEventName(id))).join(" / ")}`;
      },
    },
      {
        match: ({ key }) => key === "success" || key === "failed",
        apply: () => null,
      },
      {
        match: ({ key }) => Boolean(staticActionText(key)),
        apply: ({ key, value }) => {
          const readableValue = key === "prompt" ? promptValueText(value) : valueToReadableText(value);
          return `${prefix}：${staticActionText(key)}${mutationValueSuffix(value, { text: readableValue })}`;
        },
    },
    {
      match: ({ key }) => key === "coin" || key === "金币",
      apply: ({ value }) => `${prefix}：获得金币：${valueToReadableText(value)}`,
    },
    {
      match: ({ key }) => key.startsWith("focus."),
      apply: ({ key }) => {
        const focusId = key.slice("focus.".length);
        return `${prefix}：聚焦到仪式：${riteJumpHtml(focusId, resolveRiteName(focusId))}`;
      },
    },
    {
      match: ({ key }) => key.startsWith("hand_pop."),
      apply: () => `${prefix}：将指定卡牌加入手牌或弹出到手牌`,
    },
    {
      match: ({ key }) => key.startsWith("sudan_pool."),
      apply: ({ key }) => `${prefix}：调整苏丹牌池：${escapeHtml(key.slice("sudan_pool.".length))}`,
    },
    {
      match: ({ key }) => key === "loot" || key.startsWith("loot."),
      apply: () => `${prefix}：调整战利品或归属标记`,
    },
    {
      match: ({ key }) => key.startsWith("clean."),
      apply: ({ key, value }) => {
        const target = key.slice("clean.".length);
        if (target === "rite") {
          const ids = collectIdsFromValue(value);
          return ids.length
            ? `${prefix}：清理仪式：${ids.map((id) => riteJumpHtml(id, resolveRiteName(id))).join(" / ")}`
            : `${prefix}：清理仪式：${escapeHtml(valueToReadableText(value))}`;
        }
        return target === "rite"
          ? `${prefix}：清理仪式：${riteJumpHtml(value, resolveRiteName(value))}`
          : `${prefix}：清理槽位或标记：${target}${mutationValueSuffix(value)}`;
      },
    },
    {
      match: ({ key }) => key.startsWith("table.clean."),
      apply: ({ key, value }) => {
        const target = key.slice("table.clean.".length);
        const suffix = mutationValueSuffix(value, { keepImplicit: true });
        return `${prefix}：移除${entityRefHtml(target)}${suffix === "：1" ? "" : suffix}`;
      },
    },
    {
      match: ({ key }) => /^table\.(\d+|[^.]+)([-=])(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, target, separator, token] = key.match(/^table\.(\d+|[^.]+)([-=])(.+)$/);
        const normalizedTarget = String(target).trim();
        const numericTarget = Number(normalizedTarget);
        const targetHtml = Number.isFinite(numericTarget)
          ? cardJumpHtml(numericTarget, resolveCardName(numericTarget))
          : entityRefHtml(normalizedTarget);
        return `${prefix}：更新桌面标记：${targetHtml}${escapeHtml(separator)}${escapeHtml(token)}：${escapeHtml(valueToReadableText(value))}`;
      },
    },
    {
      match: ({ key }) => key.startsWith("table."),
      apply: ({ key, value }) => {
        const target = key.slice("table.".length).replaceAll(".uprare", ".品级提升");
        const cardMarkMatch = target.match(/^(\d+)([-=])(.+)$/);
        if (cardMarkMatch) {
          const [, cardId, separator, mark] = cardMarkMatch;
          return `${prefix}：更新桌面标记：${cardJumpHtml(Number(cardId), resolveCardName(Number(cardId)))}${escapeHtml(separator)}${escapeHtml(mark)}${mutationValueSuffix(value, { keepImplicit: true })}`;
        }
        return `${prefix}：更新桌面标记：${target}${mutationValueSuffix(value, { keepImplicit: true })}`;
      },
    },
    {
      match: ({ key }) => key.startsWith("pop.") || key.startsWith("think_pop."),
      apply: () => null,
    },
    {
      match: ({ key }) => /^s(\d+)\+equip$/.test(key),
      apply: ({ key, value }) => {
        const [, slotId] = key.match(/^s(\d+)\+equip$/);
        return `${prefix}：s${slotId}装备+${entityRefHtml(value)}`;
      },
    },
    {
      match: ({ key }) => /^s(\d+)\+(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, slotId, token] = key.match(/^s(\d+)\+(.+)$/);
        return `${prefix}：s${slotId}${escapeHtml(token)}+${escapeHtml(valueToReadableText(value))}`;
      },
    },
    {
      match: ({ key }) => /^s(\d+)-(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, slotId, token] = key.match(/^s(\d+)-(.+)$/);
        return `${prefix}：s${slotId}的${entityRefHtml(token)}-${escapeHtml(valueToReadableText(value))}`;
      },
    },
    {
      match: ({ key }) => /^s(\d+)\.(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, slotId, token] = key.match(/^s(\d+)\.(.+)$/);
        const label = token === "uprare" ? "品级提升" : entityRefHtml(token);
        return `${prefix}：s${slotId}的${label}${mutationValueSuffix(value, { keepImplicit: true })}`;
      },
    },
  ];

  actionEntries.forEach((entry) => {
    for (const rule of mutationRuleHandlers) {
      if (rule.match(entry)) {
        const result = rule.apply(entry);
        if (result) entries.push(result);
        return;
      }
    }
    entries.push(`${prefix}：${entry.key}${isImplicitMutationValue(entry.value) ? "" : ` = ${valueToReadableText(entry.value)}`}`);
  });

  return entries;
};

const collectIdsFromValue = (value) => {
  const ids = new Set();
  if (typeof value === "number") ids.add(value);
  if (typeof value === "string" && /^\d+$/.test(value)) ids.add(Number(value));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\[?\s*\d+(?:\s*,\s*\d+)+\s*\]?$/.test(trimmed)) {
      trimmed
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter(Number.isFinite)
        .forEach((id) => ids.add(id));
    }
  }
  collectNumericRefs(value, ids);
  return [...ids].filter(Number.isFinite).sort((a, b) => a - b);
};

const collectEndingIdBucket = (rawObject = {}, rawSource = "") => {
  const endingIdBucket = new Set();
  collectIdsFromObject(rawObject, "over", endingIdBucket);
  extractRepeatedKeyValues(rawSource || "", "over").forEach(({ value }) => {
    collectIdsFromValue(value).forEach((id) => endingIdBucket.add(id));
  });
  return [...endingIdBucket].filter(Number.isFinite);
};

const buildEndingTargets = (rawObject = {}, rawSource = "", seedEndingIds = []) =>
  collectJumpItems(
    [...new Set([...(seedEndingIds || []), ...collectEndingIdBucket(rawObject, rawSource)])],
    "endings",
    (target) => `${target.id} · ${target.name}`,
  );

const entryReferencesEnding = (entry, endingId, rawMeta = {}) => {
  const endingRefs = new Set(collectEndingIdBucket({
    ...((entry && typeof entry === "object") ? entry : {}),
    result: entry?.result || {},
    action: entry?.action || {},
  }, rawMeta?.rawSnippet || ""));
  return endingRefs.has(Number(endingId));
};

const renderEndingSourceEntry = (entry, titleHtml, rawMeta = {}) => `
  <div class="readable-item">
    <strong>${titleHtml}</strong>
    ${rawMeta.sourceHintHtml ? `<div class="readable-meta">${rawMeta.sourceHintHtml}</div>` : ""}
    ${
      hasConditionContent(entry.condition, rawMeta.conditionEntries)
        ? `
          <div class="readable-meta">触发条件</div>
          <div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: rawMeta.conditionEntries || null, rawSource: rawMeta.rawSnippet || "" })}</div>
        `
        : `<div class="readable-meta">无额外条件</div>`
    }
  </div>
`;

const emphasizeEndingSourceJumpHtml = (sourceJumpHtml) =>
  sourceJumpHtml
    ? `<span class="ending-source-link">${sourceJumpHtml}</span>`
    : "";

const buildEndingSourceTitleHtml = (sourceTitle, sourceJumpHtml, entryTitle, index) => (
  (() => {
    const emphasizedSourceJumpHtml = emphasizeEndingSourceJumpHtml(sourceJumpHtml);
    return entryTitle
      ? (emphasizedSourceJumpHtml
        ? `达成 ${emphasizedSourceJumpHtml} 的${escapeHtml(sourceTitle)}（${renderRichText(entryTitle)}）`
        : `${escapeHtml(sourceTitle)}（${renderRichText(entryTitle)}）`)
      : (emphasizedSourceJumpHtml
        ? `达成 ${emphasizedSourceJumpHtml} 的${escapeHtml(sourceTitle)}（${index + 1}）`
        : `${escapeHtml(sourceTitle)}（${index + 1}）`);
  })()
);

const buildOptionTextMap = (optionValue = {}) => {
  const items = Array.isArray(optionValue?.items) ? optionValue.items : [];
  return new Map(
    items
      .filter((item) => item && typeof item === "object" && item.tag)
      .map((item) => [String(item.tag), String(item.text || "")]),
  );
};

const pushEndingSourceBlocks = (sourceBlocks, endingId, entries, rawEntries, sourceTitle, sourceJumpHtml) => {
  const normalizedEntries = normalizeReadableEntries(entries || [], rawEntries || []);
  normalizedEntries.forEach((entry, index) => {
    const rawMeta = rawEntries?.[index] || {};
    const actionEntries = rawMeta.actionEntries?.length
      ? rawMeta.actionEntries
      : extractRepeatedObjectEntries(rawMeta.rawSnippet || "", "action");
    const optionEntry = actionEntries.find(({ key, value }) => key === "option" && value && typeof value === "object");
    const optionTextByTag = buildOptionTextMap(optionEntry?.value || {});
    const caseEntries = actionEntries.filter(
      ({ key, value }) => /^case:op\d+$/.test(key) && value && typeof value === "object",
    );

    const matchedCaseEntries = caseEntries.filter(({ value, rawValueSnippet }) =>
      entryReferencesEnding(value, endingId, { rawSnippet: rawValueSnippet }),
    );

    if (matchedCaseEntries.length) {
      matchedCaseEntries.forEach(({ key: caseKey, value: caseValue, rawValueSnippet }, caseIndex) => {
        const tag = caseKey.split(":")[1];
        const optionText = optionTextByTag.get(tag);
        const titleHtml = buildEndingSourceTitleHtml(sourceTitle, sourceJumpHtml, "", caseIndex);
        sourceBlocks.push(
          renderEndingSourceEntry(
            { condition: caseValue.condition || {} },
            titleHtml,
            {
              conditionEntries: extractRepeatedObjectEntries(rawValueSnippet || "", "condition"),
              sourceHintHtml: optionText ? `分支选项：${renderRichText(optionText)}` : `分支选项：${escapeHtml(tag)}`,
            },
          ),
        );
      });
      return;
    }

    if (!entryReferencesEnding(entry, endingId, rawMeta)) return;
    const entryTitle = entry.resultTitle || rawEntries?.[index]?.entry?.resultTitle || rawEntries?.[index]?.entry?.result_title || "";
    const titleHtml = buildEndingSourceTitleHtml(sourceTitle, sourceJumpHtml, entryTitle, index);
    sourceBlocks.push(
      renderEndingSourceEntry(
        entry,
        titleHtml,
        rawMeta,
      ),
    );
  });
};

const buildEndingSourceData = (item) => {
  const endingId = Number(item.id);
  if (!siteData) return { sourceBlocks: [] };

  const sourceBlocks = [];

  const vanishCards = (siteData.cards || []).filter(
    (card) => card.vanishOver !== null && card.vanishOver !== undefined && Number(card.vanishOver) === endingId,
  );
  if (vanishCards.length) {
    sourceBlocks.push(`
      <div class="readable-item">
        <strong>卡牌超时</strong>
        <div class="detail-sublist">${renderJumpList(vanishCards.map((card) => ({ id: card.id, label: `${card.id} · ${card.name}` })), "cards", { preview: true })}</div>
      </div>
    `);
  }

  (siteData.rites || []).forEach((rite) => {
    const jump = riteJumpHtml(rite.id, `${rite.id} · ${rite.name}`);
      const settlementPriorEntries = rite.settlementPriorEntries?.length ? rite.settlementPriorEntries : extractFieldArrayEntries(rite.rawSource || "", "settlement_prior");
      const settlementEntries = rite.settlementEntries?.length ? rite.settlementEntries : extractFieldArrayEntries(rite.rawSource || "", "settlement");
      const settlementExtreEntries = rite.settlementExtreEntries?.length ? rite.settlementExtreEntries : extractFieldArrayEntries(rite.rawSource || "", "settlement_extre");
      const waitingRoundEndEntries = rite.waitingRoundEndEntries?.length ? rite.waitingRoundEndEntries : extractFieldArrayEntries(rite.rawSource || "", "waiting_round_end_action");
      pushEndingSourceBlocks(sourceBlocks, endingId, rite.raw?.settlement_prior || [], settlementPriorEntries, "前置结算", jump);
      pushEndingSourceBlocks(sourceBlocks, endingId, rite.raw?.settlement || [], settlementEntries, "结算规则", jump);
      pushEndingSourceBlocks(sourceBlocks, endingId, rite.raw?.settlement_extre || [], settlementExtreEntries, "额外结算", jump);
      pushEndingSourceBlocks(sourceBlocks, endingId, rite.raw?.waiting_round_end_action || [], waitingRoundEndEntries, "仪式未处理，自动关闭", jump);
  });

  (siteData.events || []).forEach((event) => {
      const jump = eventJumpHtml(event.id, `${event.id} · ${event.text}`);
      const settlementPriorEntries = event.settlementPriorEntries?.length ? event.settlementPriorEntries : extractFieldArrayEntries(event.rawSource || "", "settlement_prior");
      const settlementEntries = event.settlementEntries?.length ? event.settlementEntries : extractFieldArrayEntries(event.rawSource || "", "settlement");
      const settlementExtreEntries = event.settlementExtreEntries?.length ? event.settlementExtreEntries : extractFieldArrayEntries(event.rawSource || "", "settlement_extre");
      pushEndingSourceBlocks(sourceBlocks, endingId, event.raw?.settlement_prior || [], settlementPriorEntries, "前置结算", jump);
      pushEndingSourceBlocks(sourceBlocks, endingId, event.raw?.settlement || [], settlementEntries, "结算规则", jump);
      pushEndingSourceBlocks(sourceBlocks, endingId, event.raw?.settlement_extre || [], settlementExtreEntries, "额外结算", jump);
  });

  (siteData.afterStory || []).forEach((afterStory) => {
      const jump = `<button class="jump jump--inline" data-tab="afterStory" data-id="${afterStory.id}" data-preview="afterStory">${escapeHtml(`${afterStory.id} · ${afterStory.name}`)}</button>`;
      const priorEntries = afterStory.priorEntries?.length ? afterStory.priorEntries : extractFieldArrayEntries(afterStory.rawSource || "", "prior");
      const extraEntries = afterStory.extraEntries?.length ? afterStory.extraEntries : extractFieldArrayEntries(afterStory.rawSource || "", "extra");
      pushEndingSourceBlocks(sourceBlocks, endingId, afterStory.prior || [], priorEntries, "后日谈前置文本", jump);
      pushEndingSourceBlocks(sourceBlocks, endingId, afterStory.extra || [], extraEntries, "后日谈额外文本", jump);
    });

  return { sourceBlocks };
};

const collectJumpIdBuckets = (rawObject = {}, rawSource = "", seedRiteIds = [], seedEventIds = []) => {
  const riteIdBucket = new Set(seedRiteIds || []);
  const eventIdBucket = new Set(seedEventIds || []);

  collectIdsFromObject(rawObject, "rite", riteIdBucket);
  collectIdsFromObject(rawObject, "is_rite", riteIdBucket);
  collectIdsFromObject(rawObject, "_is_rite", riteIdBucket);
  collectIdsFromObject(rawObject, "event_on", eventIdBucket);
  collectIdsFromObject(rawObject, "event_off", eventIdBucket);

  extractRepeatedKeyValues(rawSource || "", "rite").forEach(({ value }) => collectIdsFromValue(value).forEach((id) => riteIdBucket.add(id)));
  extractRepeatedKeyValues(rawSource || "", "is_rite").forEach(({ value }) => collectIdsFromValue(value).forEach((id) => riteIdBucket.add(id)));
  extractRepeatedKeyValues(rawSource || "", "_is_rite").forEach(({ value }) => collectIdsFromValue(value).forEach((id) => riteIdBucket.add(id)));
  extractRepeatedKeyValues(rawSource || "", "event_on").forEach(({ value }) => collectIdsFromValue(value).forEach((id) => eventIdBucket.add(id)));
  extractRepeatedKeyValues(rawSource || "", "event_off").forEach(({ value }) => collectIdsFromValue(value).forEach((id) => eventIdBucket.add(id)));

  return {
    riteIds: [...riteIdBucket].filter(Number.isFinite).sort((a, b) => a - b),
    eventIds: [...eventIdBucket].filter(Number.isFinite).sort((a, b) => a - b),
  };
};

const buildJumpTargets = (rawObject = {}, rawSource = "", seedRiteIds = [], seedEventIds = []) => {
  const { riteIds, eventIds } = collectJumpIdBuckets(rawObject, rawSource, seedRiteIds, seedEventIds);
  return {
    nextRites: collectJumpItems(riteIds, "rites", (target) => `${target.id} · ${target.name}`),
    nextEvents: collectJumpItems(eventIds, "events", (target) => `${target.id} · ${target.text}`),
  };
};

const renderActionResultNotes = (entry, rawMeta = {}) => {
  const blocks = [];
  const counterContextSource = rawMeta.contextRawSource || rawMeta.rawSnippet || "";
  if (entry.result_text) {
    blocks.push(`<div class="readable-meta">文本：${escapeHtml(entry.result_text)}</div>`);
  }
  const mergedResultEntries = mergeMutationEntries(rawMeta.resultEntries || [], entry.result || {});
  const resultLines = summarizeMutationEntries(mergedResultEntries, "结果", counterContextSource);
  if (resultLines.length) {
    blocks.push(
      `<div class="readable-meta"><strong>结果</strong></div>${resultLines
        .map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^结果：/, "")}</div>`)
        .join("")}`,
    );
  }
  const mergedActionEntries = mergeMutationEntries(rawMeta.actionEntries || [], entry.action || {});
  const optionCaseBlocks = renderOptionCaseBlocks(mergedActionEntries);
  const choiceActionBlocks = renderChoiceActionBlocks(mergedResultEntries, mergedActionEntries);
  const actionLines = summarizeMutationEntries(mergedActionEntries, "动作", counterContextSource);
  if (actionLines.length) {
    blocks.push(
      `<div class="readable-meta"><strong>动作</strong></div>${actionLines
        .map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^动作：/, "")}</div>`)
        .join("")}`,
    );
  }
  if (optionCaseBlocks) {
    blocks.push(optionCaseBlocks);
  }
  if (choiceActionBlocks) {
    blocks.push(choiceActionBlocks);
  }
  const choiceBubbleBlocks = renderChoiceBubbleBlocks(mergedResultEntries, mergedActionEntries);
  if (choiceBubbleBlocks) {
    blocks.push(choiceBubbleBlocks);
  }
  if (!blocks.length) {
    blocks.push(`<div class="readable-meta">无额外效果</div>`);
  }
  return blocks.join("");
};

const hasConditionContent = (condition, rawEntries = null) =>
  (Array.isArray(rawEntries) && rawEntries.length > 0) || Object.keys(condition || {}).length > 0;

const renderResultActionBlock = (entry, fallbackTitle, rawMeta = {}) => `
  <div class="readable-item">
    <strong>${escapeHtml(entry.result_title || fallbackTitle)}</strong>
    ${
      hasConditionContent(entry.condition, rawMeta.conditionEntries)
        ? `<div class="readable-meta">触发条件</div><div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: rawMeta.conditionEntries || null, rawSource: rawMeta.contextRawSource || rawMeta.rawSnippet || "" })}</div>`
        : ""
    }
    ${renderActionResultNotes(entry, rawMeta)}
  </div>
`;

const normalizeReadableEntries = (entries = [], rawEntries = []) =>
  (rawEntries.length ? rawEntries : entries).map((rawEntry, index) => {
    const parsedEntry = entries[index];
    if (rawEntry?.entry && Object.keys(rawEntry.entry || {}).length) {
      return { entry: rawEntry.entry, rawMeta: rawEntries[index] || rawEntry || {} };
    }
    if (parsedEntry && Object.keys(parsedEntry || {}).length) {
      return { entry: parsedEntry, rawMeta: rawEntries[index] || rawEntry || {} };
    }
    if (rawEntry?.rawSnippet) {
      try {
        const parsed = parseJsoncText(rawEntry.rawSnippet);
        if (parsed && typeof parsed === "object") {
          return { entry: parsed, rawMeta: rawEntries[index] || rawEntry || {} };
        }
      } catch {}
    }
    return { entry: parsedEntry || rawEntry?.entry || {}, rawMeta: rawEntries[index] || rawEntry || {} };
  });

const renderSettlementReadable = (entries, fallbackTitle, rawEntries = [], contextRawSource = "") =>
  renderReadableEntries(normalizeReadableEntries(entries, rawEntries), ({ entry, rawMeta }, index) =>
    renderResultActionBlock(entry, `${fallbackTitle} ${index + 1}`, {
      ...rawMeta,
      contextRawSource: contextRawSource || rawMeta.rawSnippet || "",
    }),
  );

const triggerTimingText = (key, value) => {
  if (key === "round_begin_ba") {
    if (Array.isArray(value) && value.length >= 2) {
      return `${value[0]}-${value[1]}回合后`;
    }
    return `${valueToReadableText(value)}回合后`;
  }
  if (key === "round_end_ba") {
    if (Array.isArray(value) && value.length >= 2) {
      return `${value[0]}-${value[1]}回合后的回合结束时`;
    }
    return `${valueToReadableText(value)}回合后的回合结束时`;
  }
  if (key === "round_begin") return "每回合开始时";
  if (key === "round_end") return "每回合结束时";
  if (key === "rite_end") {
    const ids = Array.isArray(value) ? value : [value];
    return `以下仪式结束后：${ids.map((id) => riteJumpHtml(id, resolveRiteName(id))).join(" / ")}`;
  }
  if (key === "rite") {
    return `场上有仪式：${riteJumpHtml(value, resolveRiteName(value))}`;
  }
  return `${key}：${valueToReadableText(value)}`;
};

const formatFormulaCounterHtml = (scope, id, rawSource = "") => {
  const label = resolveCounterLabel(id);
  const scopeLabel = scope === "global_counter" ? "全局计数器" : "计数器";
  const counterHtml = counterJumpHtml(id, `${scopeLabel} #${String(id)}`, rawSource);
  return label ? `${counterHtml}（${escapeHtml(label)}）` : counterHtml;
};

const formatFormulaTermHtml = (term, rawSource = "") => {
  const normalized = String(term).trim();
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return escapeHtml(normalized);
  const scopedCounterMatch = normalized.match(/^(global_counter|counter)\.(\d+)$/);
  if (scopedCounterMatch) {
    const [, scope, id] = scopedCounterMatch;
    return formatFormulaCounterHtml(scope, id, rawSource);
  }
  if (normalized === "rare") return "此卡槽的卡牌的品级";
  const slotRareMatch = normalized.match(/^s(\d+)\.rare$/);
  if (slotRareMatch) return `s${slotRareMatch[1]}的品级`;
  const slotTypeMatch = normalized.match(/^s(\d+)\.type$/);
  if (slotTypeMatch) return `s${slotTypeMatch[1]}的类型`;
  const slotValueMatch = normalized.match(/^s(\d+)\.(.+)$/);
  if (slotValueMatch) return noWrapHtml(`s${slotValueMatch[1]}的${entityRefHtml(slotValueMatch[2])}`);
  const specialExprMatch = normalized.match(/^e\((.+)\)$/);
  if (specialExprMatch) return noWrapHtml(`敌对槽位的卡牌的（${escapeHtml(specialExprMatch[1])}）`);
  return entityRefHtml(normalized);
};

const formatFormulaExpressionHtml = (expression, rawSource = "") => {
  const parts = [];
  const source = String(expression || "").trim();
  let buffer = "";
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }
    if ((char === "+" || char === "-") && depth === 0) {
      if (buffer.trim()) parts.push(buffer.trim());
      buffer = char;
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) parts.push(buffer.trim());

  return parts
    .map((part, index) => {
      const sign = part.startsWith("+") || part.startsWith("-") ? part[0] : "";
      const rawTerm = (sign ? part.slice(1) : part).trim();
      if (!rawTerm) return "";
      const termHtml = formatFormulaTermHtml(rawTerm, rawSource);
      if (!termHtml) return "";
      const prefix = index === 0 ? (sign === "-" ? "-" : "") : sign;
      return `${prefix}${termHtml}`;
    })
    .filter(Boolean)
    .join("");
};

const conditionRuleHtml = (key, value, rawSource = "") => {
  const cardLabel = (id, prefix = "", suffix = "") => `${prefix}${entityLabelHtml(id)}${suffix}`;
  const exactHandlers = {
    type: () => `类型：${escapeHtml(typeLabel(value))}`,
    is: () => noWrapHtml(`是：${entityLabelHtml(value)}`),
    "!is": () => noWrapHtml(`不是：${entityLabelHtml(value)}`),
    "have.妻子": () => noWrapHtml(`${entityRefHtml("妻子")}存活`),
    "!have.妻子": () => noWrapHtml(`${entityRefHtml("妻子")}已死`),
    "!table_have.追随者": () => "无追随者",
    "table_have.追随者=": () => `追随者＝${escapeHtml(valueToReadableText(value))}人`,
    "table_have.追随者.男性": () => `追随者.男性>=${escapeHtml(valueToReadableText(value))}人`,
    "table_have.追随者.女性": () => `追随者.女性>=${escapeHtml(valueToReadableText(value))}人`,
  };
  if (exactHandlers[key]) return exactHandlers[key]();

  const regexHandlers = [
    [/^s(\d+)\.type$/, (slotId) => `s${slotId}的类型是${escapeHtml(typeLabel(value))}`],
    [/^s(\d+)\.rare(>=|<=|>|<|=)$/, (slotId, operator) => `s${slotId}的品级${operator === "=" ? "=" : operator}${escapeHtml(materialFromRare(Number(value)).label)}`],
    [/^s(\d+)\.uprare$/, (slotId) => `s${slotId}的品级提升：${escapeHtml(valueToReadableText(value))}`],
    [/^rare(>=|<=|>|<|=)$/, (operator) => `品级${operator === "=" ? "=" : operator}${escapeHtml(materialFromRare(Number(value)).label)}`],
    [/^s(\d+)\.图片$/, (slotId) => `s${slotId}替换过立绘`],
    [/^table_have\.([^.]+)\.目的地$/, (token) => `目的地是${entityLabelHtml(token)}`],
    [/^have\.([^.]+)\.苏丹$/, (token) => `${entityLabelHtml(token)}成为苏丹：${escapeHtml(valueToReadableText(value))}`],
    [/^have\.([^.]+)\.宰相$/, (token) => `${entityLabelHtml(token)}成为宰相：${escapeHtml(valueToReadableText(value))}`],
    [/^!have\.([^.]+)\.苏丹$/, (token) => `${entityLabelHtml(token)}没有成为苏丹：${escapeHtml(valueToReadableText(value))}`],
    [/^!have\.([^.]+)\.宰相$/, (token) => `${entityLabelHtml(token)}没有成为宰相：${escapeHtml(valueToReadableText(value))}`],
    [/^have\.([^.]+)\.(.+)=$/, (token, mark) => `持有${entityLabelHtml(token)}的${escapeHtml(mark)}=${escapeHtml(valueToReadableText(value))}`],
    [/^!have\.([^.]+)\.(.+)=$/, (token, mark) => `不持有${entityLabelHtml(token)}的${escapeHtml(mark)}=${escapeHtml(valueToReadableText(value))}`],
    [/^have\.([^.]+)\.(.+)$/, (token, mark) => `持有${entityLabelHtml(token)}的${escapeHtml(mark)}=${escapeHtml(valueToReadableText(value))}`],
    [/^!have\.([^.]+)\.(.+)$/, (token, mark) => `不持有${entityLabelHtml(token)}的${escapeHtml(mark)}=${escapeHtml(valueToReadableText(value))}`],
    [/^s(\d+)\.is$/, (slotId) => noWrapHtml(`s${slotId}是：${entityLabelHtml(value)}`)],
    [/^!s(\d+)\.is$/, (slotId) => noWrapHtml(`s${slotId}不是：${entityLabelHtml(value)}`)],
    [/^s(\d+)\.(.+)$/, (slotId, token) => noWrapHtml(`s${slotId}是${entityRefHtml(token)}：${escapeHtml(valueToReadableText(value))}`)],
    [/^!s(\d+)\.(.+)$/, (slotId, token) => noWrapHtml(`s${slotId}不是${entityRefHtml(token)}：${escapeHtml(valueToReadableText(value))}`)],
  ];

  for (const [pattern, formatter] of regexHandlers) {
    const match = key.match(pattern);
    if (match) return formatter(...match.slice(1));
  }

  const formulaMatch = key.match(/^f:(.+?)(>=|<=|>|<|=)$/);
  if (formulaMatch) {
    const [, expression, operator] = formulaMatch;
    return `${formatFormulaExpressionHtml(expression, rawSource)}${operator}${escapeHtml(String(value))}`;
  }
  const formulaOnlyMatch = key.match(/^f:(.+)$/);
  if (formulaOnlyMatch) {
    return formatFormulaExpressionHtml(formulaOnlyMatch[1], rawSource);
  }

  const tableHaveCountMatch = key.match(/^table_have\.(.+?)\.count(>=|<=|>|<|=)$/);
  if (tableHaveCountMatch) {
    const [, name, operator] = tableHaveCountMatch;
    return tableHaveCountText(name, operator, value);
  }
  const tableHaveRangeMatch = key.match(/^table_have\.(.+?)(>=|<=|>|<|=)$/);
  if (tableHaveRangeMatch) {
    const [, name, operator] = tableHaveRangeMatch;
    return `${escapeHtml(tableHaveRangeLabel(name))}${operator === "=" ? "＝" : operator}${escapeHtml(valueToReadableText(value))}`;
  }
  const rangeMatch = key.match(/^(r\d+:[^<>=]+)(>=|<=|>|<|=)$/);
  if (rangeMatch) {
    const [, left, operator] = rangeMatch;
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    const formulaLeftMatch = left.match(/^(r\d+):(.+)$/);
    if (formulaLeftMatch) {
      const [, prefix, expression] = formulaLeftMatch;
      return `${escapeHtml(prefix)}: ${formatFormulaExpressionHtml(expression, rawSource)}${operator} ${escapeHtml(valueToReadableText(normalizedValue))}`;
    }
    return `${escapeHtml(left)}${operator} ${escapeHtml(valueToReadableText(normalizedValue))}`;
  }
  const costMatch = key.match(/^cost\.(.+?)(>=|<=|>|<|=)$/);
  if (costMatch) {
    const [, name, operator] = costMatch;
    const readableValue = Array.isArray(value)
      ? value.map((item) => escapeHtml(valueToReadableText(item))).join("~")
      : escapeHtml(valueToReadableText(value));
    return `花费：${escapeHtml(name)}${operator === "=" ? "=" : operator}${readableValue}`;
  }
  const plainCostMatch = key.match(/^cost\.(.+)$/);
  if (plainCostMatch) {
    const [, name] = plainCostMatch;
    const readableValue = Array.isArray(value)
      ? value.map((item) => escapeHtml(valueToReadableText(item))).join("~")
      : escapeHtml(valueToReadableText(value));
    return `花费：${escapeHtml(name)}：${readableValue}`;
  }
  const matchers = [
    [/^!s(\d+)$/, (slot) => `s${slot}：空`],
    [/^!have\.(\d+|[^.]+)(?:\.(.+))?$/, (id, mark = "") => `不存在${cardLabel(id)}${mark ? `的${escapeHtml(mark)}` : ""}`],
    [/^have\.(\d+|[^.]+)(?:\.(.+))?$/, (id, mark = "") => `持有${cardLabel(id)}${mark ? `的${escapeHtml(mark)}` : ""}`],
    [
      /^!table_have\.(\d+|[^.]+)(?:\.(.+))?$/,
      (id, mark = "") =>
        /^\d+$/.test(String(id))
          ? `${entityLabelHtml(id)}已死${mark ? `，且不带有 ${escapeHtml(mark)}` : ""}`
          : `${escapeHtml(tableHaveStateText(id)).replace(/闲置$/, "")}不闲置${mark ? `，且不带有 ${escapeHtml(mark)}` : ""}`,
    ],
    [
      /^table_have\.(\d+|[^.]+)(?:\.(.+))?$/,
      (id, mark = "") =>
        /^\d+$/.test(String(id))
          ? `${entityLabelHtml(id)}闲置存活${mark ? `，且带有 ${escapeHtml(mark)}` : ""}`
          : `${escapeHtml(tableHaveStateText(id))}${mark ? `，且带有 ${escapeHtml(mark)}` : ""}`,
    ],
    [/^!hand_have\.(\d+|[^.]+)(?:\.(.+))?$/, (id, mark = "") => `手牌中不存在${cardLabel(id)}${mark ? `，且不带有 ${escapeHtml(mark)}` : ""}`],
    [/^hand_have\.(\d+|[^.]+)(?:\.(.+))?$/, (id, mark = "") => `手牌中存在${cardLabel(id)}${mark ? `，且带有 ${escapeHtml(mark)}` : ""}`],
    [/^rite_end\.(\d+)$/, (id) => `完成仪式${riteJumpHtml(id, resolveRiteName(id))}：${escapeHtml(valueToReadableText(value))}`],
    [/^!rite$/, () => `场上无仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^rite$/, () => `场上有仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^!is_rite$/, () => `不是仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^is_rite$/, () => `是仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^!_is_rite$/, () => `不是仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^_is_rite$/, () => `是仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => counterRuleText("counter", name, operator, value, rawSource)],
    [/^!counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => `不满足：${counterRuleText("counter", name, operator, value, rawSource)}`],
    [/^global_counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => counterRuleText("global_counter", name, operator, value, rawSource)],
    [/^!global_counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => `不满足：${counterRuleText("global_counter", name, operator, value, rawSource)}`],
  ];

  for (const [pattern, formatter] of matchers) {
    const match = key.match(pattern);
    if (match) {
      return formatter(...match.slice(1));
    }
  }

  if (key.startsWith("!")) {
    return value === 1
      ? `非${escapeHtml(key.slice(1))}`
      : `非${escapeHtml(key.slice(1))}：${escapeHtml(valueToReadableText(value))}`;
  }

  return `${escapeHtml(key)}：${escapeHtml(valueToReadableText(value))}`;
};

const renderOpenConditionDetails = (conditions) =>
  renderReadableEntries(conditions, (entry) => `
    <div class="readable-item">
      <strong>${renderRichText(entry.tips || "开放条件")}</strong>
      <div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: entry.conditionEntries || null, rawSource: entry.rawSnippet || "" })}</div>
    </div>
  `);

const renderConditionLinesHtml = (condition, { bullets = true, rawEntries = null, rawSource = "" } = {}) =>
  `<div class="condition-list">${conditionLines(condition, 0, rawEntries, rawSource)
    .map(
      (line) => `
    <div class="condition-line condition-line--depth-${Math.min(line.depth, 3)}">
      <div class="readable-meta">${bullets && line.depth > 0 ? "&middot; " : ""}${line.html}</div>
    </div>
  `,
    )
    .join("")}</div>`;

const renderSlotDetails = (slots) =>
  renderReadableEntries(slots, (slot) => `
    <div class="readable-item">
      <strong>${escapeHtml(slot.slotId)} · ${renderRichText(slot.text || "未命名槽位")}</strong>
      <div class="detail-sublist">${renderConditionLinesHtml(slot.condition || {}, { bullets: false, rawEntries: slot.conditionEntries || null, rawSource: slot.rawSnippet || "" })}</div>
      <div class="readable-meta readable-meta--slot-footer">
        可空：${slot.isEmptyAllowed ? "是" : "否"}，敌对槽位：${slot.isEnemy ? "是" : "否"}${slot.openAdsorb ? "，开启吸入：是" : ""}
      </div>
    </div>
  `);

const renderRandomTextDetails = (entries) =>
  Object.entries(entries || {})
    .map(
      ([key, text]) => `
        <div class="readable-item">
          <strong>${escapeHtml(key)}</strong>
          <div class="readable-meta">${renderRichText(String(text || ""))}</div>
        </div>
      `,
    )
    .join("");

const renderRandomTextUpDetails = (entries) =>
  Object.entries(entries || {})
    .map(([key, item]) => {
      const rows = [];
      if (item?.text) rows.push(["文本", item.text]);
      if (item?.type) rows.push(["类型", item.type]);
      if (item?.type_tips) rows.push(["类型说明", item.type_tips]);
      if (item?.low_target !== undefined && item?.low_target !== null) rows.push(["最低目标", item.low_target]);
      if (item?.low_target_tips) rows.push(["最低目标说明", item.low_target_tips]);
      return `
        <div class="readable-item">
          <strong>${escapeHtml(key)}</strong>
          ${renderKvRows(rows)}
        </div>
      `;
    })
    .join("");

const normalizeTriggerEntries = (onObject) => {
  const entries = Array.isArray(onObject)
    ? onObject
    : Object.entries(onObject || {}).map(([key, value]) => ({ key, value }));

  const grouped = new Map();
  entries.forEach(({ key, value }) => {
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(value);
  });

  return [...grouped.entries()].map(([key, values]) => ({
    key,
    value: values.length === 1 ? values[0] : values,
  }));
};

const renderTriggerDetails = (onObject) =>
  renderReadableEntries(
    normalizeTriggerEntries(onObject),
    (entry) => `
      <div class="readable-item readable-item--plain">
        <strong>${triggerTimingText(entry.key, entry.value)}</strong>
      </div>
    `,
  );

const conditionLines = (node, depth = 0, rawEntries = null, rawSource = "") => {
  if (!node || typeof node !== "object") {
    return [{ depth, html: escapeHtml(valueToReadableText(node)) }];
  }
  const entries = rawEntries?.length
    ? rawEntries.map((entry) => [entry.key, entry.value, entry.rawValueSnippet || null])
    : Object.entries(node).map(([key, value]) => [key, value, null]);
  if (!entries.length) return [{ depth, html: "无" }];

  const combinedEntries = [];
  for (let index = 0; index < entries.length; index += 1) {
    const [key, value, rawValueSnippet] = entries[index];
    const rangeLeft = key.match(/^table_have\.(.+?)<$/);
    if (rangeLeft) {
      const nextEntry = entries[index + 1];
      if (nextEntry) {
        const [nextKey, nextValue] = nextEntry;
        const rangeRight = nextKey.match(/^table_have\.(.+?)>=$/);
        if (rangeRight && rangeRight[1] === rangeLeft[1]) {
          combinedEntries.push([
            "__combined_range__",
            {
              name: rangeLeft[1],
              min: nextValue,
              max: value,
            },
          ]);
          index += 1;
          continue;
        }
      }
    }
    combinedEntries.push([key, value, rawValueSnippet]);
  }

  return combinedEntries.flatMap(([key, value, rawValueSnippet]) => {
    if (key === "__combined_range__") {
      return [
        {
          depth,
          html: `${escapeHtml(valueToReadableText(value.min))}≤${escapeHtml(tableHaveRangeLabel(value.name))}＜${escapeHtml(valueToReadableText(value.max))}`,
        },
      ];
    }
    if (key === "any" || key === "all") {
      return [
        { depth, html: key === "any" ? "满足任意一条" : "需要同时满足" },
        ...conditionLines(value, depth + 1, rawValueSnippet ? extractObjectEntriesFromSnippet(rawValueSnippet) : null, rawSource || rawValueSnippet || ""),
      ];
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return [
        { depth, html: `${escapeHtml(key)}：` },
        ...conditionLines(value, depth + 1, rawValueSnippet ? extractObjectEntriesFromSnippet(rawValueSnippet) : null, rawSource || rawValueSnippet || ""),
      ];
    }
    return [{ depth, html: conditionRuleHtml(key, value, rawSource || rawValueSnippet || "") }];
  });
};

const renderConditionDetails = (condition) => renderConditionLinesHtml(condition, { bullets: true });

const renderJumpSection = (title, items, tab) =>
  Array.isArray(items) && items.length
    ? `
      <div class="readable-item">
        <strong>${title}</strong>
        ${renderJumpList(items, tab, { preview: true })}
      </div>
    `
    : "";

const renderJumpSummary = (rites, events) => `
  <div class="readable-list">
    ${renderJumpSection("仪式跳转", rites, "rites")}
    ${renderJumpSection("事件跳转", events, "events")}
  </div>
`;

const renderJumpSummaryWithEndings = (rites, events, endings) => `
  <div class="readable-list">
    ${renderJumpSection("仪式跳转", rites, "rites")}
    ${renderJumpSection("事件跳转", events, "events")}
    ${renderJumpSection("结局跳转", endings, "endings")}
  </div>
`;

const wrapScrollableSection = (html) => `<div class="detail-scrollbox">${html}</div>`;
const hasJumpTargets = (rites, events) =>
  (Array.isArray(rites) && rites.length > 0) ||
  (Array.isArray(events) && events.length > 0);
const hasEndingTextExtra = (entries) =>
  Array.isArray(entries) &&
  entries.some((entry) => entry && typeof entry === "object" && (entry.result_text || hasConditionContent(entry.condition, entry.conditionEntries)));
const renderEndingTextExtra = (entries, rawSource = "") =>
  renderReadableEntries(entries, (entry, index) => `
    <div class="readable-item">
      <strong>${escapeHtml(entry.result_title || `差分 ${index + 1}`)}</strong>
      ${
        hasConditionContent(entry.condition, entry.conditionEntries)
          ? `<div class="readable-meta">触发条件</div><div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: entry.conditionEntries || null, rawSource: entry.rawSnippet || rawSource })}</div>`
          : ""
      }
      ${
        entry.result_text
          ? `<div class="readable-meta">文本：${renderRichText(entry.result_text)}</div>`
          : `<div class="readable-meta">无文本</div>`
      }
    </div>
  `);

const openModalIfNeeded = () => {
  if (!mobileMq.matches || !detailModal) return;
  if (detailModal.hidden) {
    mobileDetailModalHistory = [];
  }
  detailModal.hidden = false;
  document.body.style.overflow = "hidden";
  updateDetailModalBackButton();
};

const pushMobileDetailModalState = () => {
  if (!mobileMq.matches || !detailModal || !detailModalContent || detailModal.hidden) return;
  pushHistoryHtml(mobileDetailModalHistory, detailModalContent.innerHTML, updateDetailModalBackButton);
};

const updateDetailModalBackButton = () => {
  if (!detailModalBack) return;
  detailModalBack.hidden = !mobileMq.matches || mobileDetailModalHistory.length === 0;
};

const updateCardPreviewBackButton = () => {
  if (!cardPreviewBack) return;
  cardPreviewBack.hidden = cardPreviewHistory.length === 0;
};

const pushHistoryHtml = (history, html, onUpdate) => {
  if (!html.trim()) return;
  history.push(html);
  onUpdate?.();
};

const resetHistory = (history, onUpdate) => {
  history.length = 0;
  onUpdate?.();
};

const restoreHistoryHtml = (contentEl, history, onUpdate) => {
  if (!contentEl || history.length === 0) return false;
  contentEl.innerHTML = history.pop();
  bindJumpEventsIn(contentEl);
  onUpdate?.();
  return true;
};

const renderPreviewHtml = (tab, id) => {
  if (tab === "cards") {
    const item = findCardById(id);
    return item ? renderCardDetailHtml(item, { includeRaw: true }) : "";
  }
  if (tab === "rites") {
    const item = indices?.rites?.get(Number(id));
    return item ? renderRiteDetailHtml(item, { includeRaw: true }) : "";
  }
  if (tab === "events") {
    const item = indices?.events?.get(Number(id));
    return item ? renderEventDetailHtml(item, { includeRaw: true }) : "";
  }
  if (tab === "endings") {
    const item = indices?.endings?.get(Number(id));
    return item ? renderEndingDetailHtml(item, { includeRaw: true }) : "";
  }
  if (tab === "afterStory") {
    const item = indices?.afterStory?.get(Number(id));
    return item ? renderAfterStoryDetailHtml(item, { includeRaw: true }) : "";
  }
  if (tab === "quests") {
    const item = indices?.quests?.get(Number(id));
    return item ? renderQuestDetailHtml(item, { includeRaw: true }) : "";
  }
  return "";
};

const openPreviewHtml = (previewHtml) => {
  if (!previewHtml) return;

  if (mobileMq.matches) {
    if (!detailModal || !detailModalContent) return;
    pushMobileDetailModalState();
    detailModalContent.innerHTML = previewHtml;
    detailModal.hidden = false;
    document.body.style.overflow = "hidden";
    bindJumpEventsIn(detailModalContent);
    return;
  }

  if (!cardPreview || !cardPreviewContent) return;
  if (!cardPreview.hidden) {
    pushHistoryHtml(cardPreviewHistory, cardPreviewContent.innerHTML, updateCardPreviewBackButton);
  } else {
    resetHistory(cardPreviewHistory, updateCardPreviewBackButton);
  }
  cardPreviewContent.innerHTML = previewHtml;
  cardPreview.hidden = false;
  updateCardPreviewBackButton();
  bindJumpEventsIn(cardPreviewContent);
};

const openEntityPreview = (tab, id) => {
  openPreviewHtml(renderPreviewHtml(tab, id));
};

const openCounterPreview = (token) => {
  openPreviewHtml(renderCounterPreviewHtml(token));
};

const closeCardPreview = () => {
  if (!cardPreview) return;
  cardPreview.hidden = true;
  resetHistory(cardPreviewHistory, updateCardPreviewBackButton);
};

const goBackCardPreview = () => {
  restoreHistoryHtml(cardPreviewContent, cardPreviewHistory, updateCardPreviewBackButton);
};

const closeDetailModal = () => {
  if (!detailModal) return;
  detailModal.hidden = true;
  resetHistory(mobileDetailModalHistory, updateDetailModalBackButton);
  document.body.style.overflow = "";
};

const goBackDetailModal = () => {
  if (!mobileMq.matches) return;
  restoreHistoryHtml(detailModalContent, mobileDetailModalHistory, updateDetailModalBackButton);
};

const updateScrollTopButton = () => {
  if (!scrollTopBtn) return;
  scrollTopBtn.hidden = window.scrollY <= 320;
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const syncDetailToModal = () => {
  if (mobileMq.matches && detailModalContent) {
    detailModalContent.innerHTML = detailPane.innerHTML;
    updateDetailModalBackButton();
  }
};

const bindJumpEventsIn = (root) => {
  root?.querySelectorAll(".jump").forEach((button) => {
    button.addEventListener("click", () => {
        if (button.dataset.preview === "counter") {
          openCounterPreview(button.dataset.counterToken);
          return;
        }
        if (
          button.dataset.preview === "card" ||
          button.dataset.preview === "rite" ||
          button.dataset.preview === "event" ||
          button.dataset.preview === "ending" ||
          button.dataset.preview === "quest"
        ) {
          openEntityPreview(button.dataset.tab, button.dataset.id);
          return;
        }
      if (mobileMq.matches && detailModalContent && detailModal && !detailModal.hidden && detailModalContent.contains(button)) {
        pushMobileDetailModalState();
      }
      jumpTo(button.dataset.tab, Number(button.dataset.id));
      openModalIfNeeded();
    });
  });
};

const bindJumpEvents = () => {
  bindJumpEventsIn(detailPane);
  bindJumpEventsIn(detailModalContent);
};

const setImportStatus = (text, isError = false) => {
  if (!importStatus) return;
  importStatus.textContent = text;
  importStatus.style.color = isError ? "#f0b3a5" : "";
};

const setupImportUi = () => {
  if (!hero) return;
  hero.querySelector("h1")?.replaceChildren(document.createTextNode("苏丹的游戏配置阅读器"));
  hero.querySelector(".hero__lead")?.replaceChildren(
    document.createTextNode("导入游戏的 config.zip 或 config 文件夹，浏览器会在本地解析这些配置文件。"),
  );
  appVersion?.replaceChildren(document.createTextNode(`${APP_VERSION} · 更新于 ${APP_UPDATED_AT}`));
  document.querySelector("#summary h2")?.replaceChildren(document.createTextNode("概览"));
  document.querySelector("#explorer h2")?.replaceChildren(document.createTextNode("配置阅读器"));
  document.querySelector(".detail-modal__title")?.replaceChildren(document.createTextNode("详情信息"));
  detailModalBack && (detailModalBack.textContent = "返回");
  detailModalClose && (detailModalClose.textContent = "关闭");
  document.querySelector(".card-preview__title")?.replaceChildren(document.createTextNode("详情信息"));
  cardPreviewBack && (cardPreviewBack.textContent = "返回");
  cardPreviewClose && (cardPreviewClose.textContent = "关闭");
  searchInput?.setAttribute("placeholder", "搜索 ID、名称、title、提示词");
  tabs.forEach((tab) => {
    const labelMap = { all: "全部", cards: "卡牌", rites: "仪式", events: "事件", endings: "结局" };
    tab.textContent = labelMap[tab.dataset.target] || tab.textContent;
  });
  cardSubtabsButtons.forEach((tab) => {
    const labelMap = { all: "全部卡牌", sudan: "苏丹卡", item: "物品", char: "角色" };
    tab.textContent = labelMap[tab.dataset.cardFilter] || tab.textContent;
  });
  riteSubtabsButtons.forEach((tab) => {
    const labelMap = { all: "全部仪式", TREASURE: "奇珍" };
    tab.textContent = labelMap[tab.dataset.riteFilter] || tab.textContent;
  });

  importStatus = document.querySelector("#importStatus");
  zipInput = document.querySelector("#zipInput");
  folderInput = document.querySelector("#folderInput");
  importZipBtn = document.querySelector("#importZipBtn");
  importFolderBtn = document.querySelector("#importFolderBtn");
  clearCacheBtn = document.querySelector("#clearCacheBtn");

  importZipBtn?.addEventListener("click", () => zipInput?.click());
  importFolderBtn?.addEventListener("click", () => folderInput?.click());
  zipInput?.addEventListener("change", async () => {
    if (!zipInput.files?.[0]) return;
    await importZipFile(zipInput.files[0]);
    zipInput.value = "";
  });
  folderInput?.addEventListener("change", async () => {
    if (!folderInput.files?.length) return;
    await importFolderFiles([...folderInput.files]);
    folderInput.value = "";
  });
  clearCacheBtn?.addEventListener("click", async () => {
    await cacheDelete(CACHE_KEY);
    siteData = null;
    indices = null;
    summaryGrid.innerHTML = "";
    generatedAt.textContent = "";
    explorerMeta.textContent = "尚未导入本地配置数据";
    explorerList.innerHTML = "";
    detailPane.innerHTML = `<div class="detail-pane__empty">先导入本地配置数据，然后从左侧选择一条配置查看详情。</div>`;
    setImportStatus("已清除本地缓存。");
  });
};

const buildFileMapFromZip = async (file) => {
  const JSZip = await ensureJsZip();
  const zip = await JSZip.loadAsync(file);
  const fileMap = new Map();
  const entries = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir || !relativePath.endsWith(".json")) return;
    entries.push([relativePath, entry]);
  });
  for (let index = 0; index < entries.length; index += 1) {
    const [relativePath, entry] = entries[index];
    setImportStatus(`正在解压并读取 config.zip… ${index + 1}/${entries.length}`);
    const content = await entry.async("string");
    fileMap.set(normalizeImportPath(relativePath), content);
  }
  return fileMap;
};

const buildFileMapFromFolder = async (files) => {
  const fileMap = new Map();
  const jsonFiles = files.filter((file) => file.name.endsWith(".json"));
  for (let index = 0; index < jsonFiles.length; index += 1) {
    const file = jsonFiles[index];
    setImportStatus(`正在读取配置文件夹… ${index + 1}/${jsonFiles.length}`);
    const content = await file.text();
    fileMap.set(normalizeImportPath(file.webkitRelativePath || file.name), content);
  }
  return fileMap;
};

const buildCachePayload = ({ data, fingerprint, importFingerprint, sourceLabel }) => ({
  schemaVersion: CACHE_SCHEMA_VERSION,
  dataFingerprint: fingerprint,
  importFingerprint,
  sourceLabel,
  cachedAt: new Date().toISOString(),
  data,
});

const migrateCachedData = (data) => {
  if (!data) return data;
  return {
    ...data,
    commentDictionary: mergeCommentDictionary(createEmptyCommentDictionary(), data.commentDictionary),
    cards: (data.cards || []).map((item) => ({
      ...item,
      postRiteEntries: item.postRiteEntries || extractFieldArrayEntries(item.rawSource || "", "post_rite"),
    })),
    rites: (data.rites || []).map((item) => ({
      ...item,
      settlementExtreCount: item.settlementExtreCount || item.raw?.settlement_extre?.length || 0,
      settlementExtreEntries: item.settlementExtreEntries || [],
      openConditions: (item.openConditions || []).map((entry) => ({
        ...entry,
        conditionEntries: entry.conditionEntries || [],
      })),
    })),
    events: (data.events || []).map((item) => ({
      ...item,
      settlementExtreCount: item.settlementExtreCount || item.raw?.settlement_extre?.length || 0,
      settlementExtreEntries: item.settlementExtreEntries || [],
      conditionEntries: item.conditionEntries || [],
    })),
    endings: (data.endings || []).map((item) => ({
      ...item,
      sourcePath: item.sourcePath || "over.json",
      raw: item.raw || {
        name: item.name || "",
        sub_name: item.subName || "",
        text: item.text || "",
        open_after_story: Boolean(item.openAfterStory),
      },
      rawSource: item.rawSource || "",
      textExtra: item.textExtra || item.raw?.text_extra || [],
      textExtraEntries: item.textExtraEntries || [],
    })),
    quests: (data.quests || []).map((item) => ({
      ...item,
      sourcePath: item.sourcePath || "quest.json",
      target: Array.isArray(item.target) ? item.target : [],
      targetEntries: item.targetEntries || extractFieldArrayEntries(item.rawSource || "", "target"),
      favourText: item.favourText || item.raw?.favour_text || "",
      upgradePoint: item.upgradePoint ?? item.raw?.upgrade_point ?? 0,
      pre: item.pre ?? item.raw?.pre ?? 0,
      icon: item.icon || item.raw?.icon || "",
    })),
  };
};

const normalizeCachedPayload = (payload) => {
  if (!payload) return null;
  if (payload.schemaVersion !== CACHE_SCHEMA_VERSION) {
    return null;
  }
  if (payload.data) {
    return {
      ...payload,
      data: migrateCachedData(payload.data),
    };
  }
  return null;
};

const hydrateSiteData = async (data, sourceLabel, fingerprint, importFingerprint) => {
  siteData = data;
  indices = createIndices();
  setImportStatus("正在写入本地缓存…");
  await cacheSet(CACHE_KEY, buildCachePayload({ data, fingerprint, importFingerprint, sourceLabel }));
  renderSummary();
  renderExplorer();
  setImportStatus(`已载入本地数据：${sourceLabel}`);
};

const tryReuseCachedImport = async (importFingerprint, sourceLabel) => {
  const cachedPayload = normalizeCachedPayload(await cacheGet(CACHE_KEY));
  if (!cachedPayload?.data || !importFingerprint) return false;
  if (cachedPayload.importFingerprint !== importFingerprint) return false;
  siteData = cachedPayload.data;
  indices = createIndices();
  renderSummary();
  renderExplorer();
  setImportStatus(`已直接复用上次导入的数据：${sourceLabel}`);
  return true;
};

const importZipFile = async (file) => {
  try {
    setImportBusy(true);
    const importFingerprint = fingerprintZipImport(file);
    setImportStatus(`正在检查 ${file.name} 是否已经导入过…`);
    if (await tryReuseCachedImport(importFingerprint, file.name)) return;
    setImportStatus(`正在导入 ${file.name}…`);
    const fileMap = await buildFileMapFromZip(file);
    const fingerprint = fingerprintFileMap(fileMap);
    setImportStatus("正在解析基础数据…");
    const data = buildSiteDataFromFileMap(fileMap);
    await hydrateSiteData(data, file.name, fingerprint, importFingerprint);
  } catch (error) {
    setImportStatus(`导入失败：${error.message || error}`, true);
  } finally {
    setImportBusy(false);
  }
};

const importFolderFiles = async (files) => {
  try {
    setImportBusy(true);
    const importFingerprint = fingerprintFolderImport(files);
    setImportStatus("正在检查配置文件夹是否已经导入过…");
    if (await tryReuseCachedImport(importFingerprint, "配置文件夹")) return;
    setImportStatus("正在导入配置文件夹…");
    const fileMap = await buildFileMapFromFolder(files);
    const fingerprint = fingerprintFileMap(fileMap);
    setImportStatus("正在解析基础数据…");
    const data = buildSiteDataFromFileMap(fileMap);
    await hydrateSiteData(data, "配置文件夹", fingerprint, importFingerprint);
  } catch (error) {
    setImportStatus(`导入失败：${error.message || error}`, true);
  } finally {
    setImportBusy(false);
  }
};

const renderSummary = () => {
  const items = [
    ["全部卡牌", siteData.summary.totalCardCount || 0],
    ["仪式", siteData.summary.riteCount],
    ["事件", siteData.summary.eventCount],
    ["结局", siteData.summary.endingCount],
    ["后日谈", siteData.summary.afterStoryCount],
    ["一千零一夜", siteData.summary.questCount || 0],
  ];

  summaryGrid.innerHTML = "";
  items.forEach(([label, value]) => {
    const node = document.createElement("div");
    node.className = "stat-card";
    node.innerHTML = `<div class="stat-card__value">${value}</div><div class="stat-card__label">${label}</div>`;
    summaryGrid.appendChild(node);
  });

  generatedAt.textContent = `数据生成时间：${formatDateTime(siteData.generatedAt)}`;
};

const dataForTab = () => {
  if (currentTab === "all") {
    return allEntries();
  }
  if (currentTab === "cards") {
    return currentCardFilter === "all"
      ? siteData.cards
      : siteData.cards.filter((item) => item.type === currentCardFilter);
  }
  if (currentTab === "rites") {
    return currentRiteFilter === "all"
      ? siteData.rites
      : siteData.rites.filter((item) => item.type === currentRiteFilter);
  }
  if (currentTab === "events") return siteData.events;
  if (currentTab === "endings") return siteData.endings;
  if (currentTab === "afterStory") return siteData.afterStory || [];
  if (currentTab === "quests") return siteData.quests || [];
  return [];
};

const searchTokens = (entry) => {
  const values = new Set();
  const push = (value) => {
    if (value === null || value === undefined || value === "") return;
    values.add(String(value).trim().toLowerCase());
  };

  push(entry.id);
  push(entry.name);
  push(entry.text);
  push(entry.title);
  push(entry.subName);
  push(entry.favourText);
  push(entry.sourcePath);
  push(entry.kind);
  push(
    {
      cards: "卡牌",
      rites: "仪式",
      events: "事件",
      endings: "结局",
      afterStory: "后日谈",
      quests: "一千零一夜",
    }[entry.kind],
  );
  push(entry.type);
  push(typeLabel(entry.type));
  push(gradeLabel(entry));
  push(formatTagTips(entry.tagTips || []));
  (entry.tagTips || []).forEach(push);
  (entry.tipsText || []).forEach(push);
  (entry.prompts || []).forEach(push);

  if (entry.kind === "cards") {
    Object.keys(entry.tags || {}).forEach(push);
  }

  return [...values];
};

const kindLabelMap = {
  cards: "卡牌",
  rites: "仪式",
  events: "事件",
  endings: "结局",
  afterStory: "后日谈",
  quests: "一千零一夜",
};

const kindTagHtml = (kind) => {
  const label = kindLabelMap[kind];
  return label ? `<span class="pill">${escapeHtml(label)}</span>` : "";
};

const matches = (entry, keyword) => {
  if (!keyword) return true;
  const normalizedKeyword = keyword.toLowerCase();
  if (exactMatchInput?.checked) {
    return searchTokens(entry).some((token) => token === normalizedKeyword);
  }
  const haystack = JSON.stringify(entry).toLowerCase();
  return haystack.includes(normalizedKeyword);
};

const renderCardDetailHtml = (item, { includeRaw = true } = {}) => {
  ensureCommentDictionaryForItem(item);
  const isChar = item.type === "char";
  const isItem = item.type === "item";
  const showTitlePill = (isChar || isItem) && item.title;
  const showLife = item.vanishDays > 0;
  const showEndingInfo = item.vanishOver !== null && item.vanishOver !== undefined;
  const effectivePostRiteEntries = item.postRiteEntries || extractFieldArrayEntries(item.rawSource || "", "post_rite");
  const hasPostRiteBlock = hasReadableEntries(effectivePostRiteEntries);
  const { nextRites } = buildJumpTargets(item.raw || {}, item.rawSource || "");
  const hasJumpBlock = hasJumpTargets(nextRites, []);
  const vanishEvents = collectJumpItems(item.vanishEventIds, "events", (target) => `${target.id} · ${target.text}`);
  const vanishRites = collectJumpItems(item.vanishRiteIds, "rites", (target) => `${target.id} · ${target.name}`);
  const hasVanishEffect = showLife || showEndingInfo || vanishEvents.length > 0 || vanishRites.length > 0;
  const endingTarget =
    item.vanishOver && indices.endings.get(item.vanishOver)
      ? [{ id: item.vanishOver, label: `${item.vanishOver} · ${indices.endings.get(item.vanishOver).name}` }]
      : [];
  const counterRefs = [...collectCounterRefs(item.raw || {})].sort((a, b) => Number(a) - Number(b));

  return `
    <div class="detail-pane__header">
      <h3>${renderRichTitle(item.id, item.name)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText(item.text || "无说明文本")}</p>
    <div class="pill-list">
      ${kindTagHtml("cards")}
      <span class="pill">类型: ${escapeHtml(typeLabel(item.type))}</span>
      <span class="pill">品级: ${escapeHtml(gradeLabel(item))}</span>
      ${showTitlePill ? `<span class="pill">title: ${escapeHtml(item.title)}</span>` : ""}
      ${hasPostRiteBlock ? `<span class="pill">后续规则: ${effectivePostRiteEntries.length}条</span>` : ""}
      ${formatCardVanishPills(item)}
      ${tutorialSudanIds.has(item.id) ? `<span class="tutorial-mark">教程卡</span>` : ""}
    </div>
    <div class="detail-pane__section">
      <h3>结构化信息</h3>
      <div class="detail-pane__kv">
        <div class="detail-pane__card">
          <strong>基础信息</strong>
          ${renderKvRows([
            ["ID", item.id],
            ["名称", item.name],
            ["title", item.title],
            ["类型", typeLabel(item.type)],
            ["品级", gradeLabel(item)],
            ...(hasPostRiteBlock ? [["后续规则", `${effectivePostRiteEntries.length} 条`]] : []),
            ...(isChar ? [["可装备", formatEquips(item.equips)]] : []),
          ])}
        </div>
        <div class="detail-pane__card">
          <strong>标签 / 属性</strong>
          ${renderKvRows(Object.entries(item.tags || {}))}
        </div>
        ${
          hasVanishEffect
            ? `
              <div class="detail-pane__card">
                <strong>消失规则</strong>
                ${renderKvRows([
                  ...(showLife ? [["持续天数", item.vanishDays]] : []),
                  ...(showEndingInfo ? [["超时结局", item.vanishOver ?? "无"]] : []),
                  ...(vanishEvents.length ? [["到时事件", `${vanishEvents.length} 条`]] : []),
                  ...(vanishRites.length ? [["到时仪式", `${vanishRites.length} 条`]] : []),
                ])}
              </div>
              ${
                showEndingInfo
                  ? `
                    <div class="detail-pane__card">
                      <strong>结局跳转</strong>
                      ${renderJumpList(endingTarget, "endings", { preview: true })}
                    </div>
                  `
                  : ""
              }
              ${
                vanishEvents.length || vanishRites.length
                  ? `
                    <div class="detail-pane__card">
                      <strong>到时跳转</strong>
                      ${
                        vanishEvents.length
                          ? `<div class="readable-meta">事件</div><div class="detail-sublist">${renderJumpList(vanishEvents, "events", { preview: true })}</div>`
                          : ""
                      }
                      ${
                        vanishRites.length
                          ? `${vanishEvents.length ? `<div style="height:10px"></div>` : ""}<div class="readable-meta">仪式</div><div class="detail-sublist">${renderJumpList(vanishRites, "rites", { preview: true })}</div>`
                          : ""
                      }
                    </div>
                  `
                  : ""
              }
            `
            : ""
        }
      </div>
    </div>
    ${
      hasPostRiteBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续规则</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.post_rite || [], "后续规则", effectivePostRiteEntries, item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasJumpBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续跳转</summary>
            <div>${wrapScrollableSection(renderJumpSummary(nextRites, []))}</div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs, item.rawSource)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${rawConfigBlock(item)}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderRiteDetailHtml = (item, { includeRaw = true } = {}) => {
  ensureCommentDictionaryForItem(item);
  const { nextRites, nextEvents } = buildJumpTargets(item.raw || {}, item.rawSource || "", item.nextRiteIds || [], item.nextEventIds || []);
  const nextEndings = buildEndingTargets(item.raw || {}, item.rawSource || []);
  const cardRefs = collectConditionCardRefs({
    cards_slot: item.raw?.cards_slot || {},
    open_conditions: item.raw?.open_conditions || [],
    settlement_prior: item.raw?.settlement_prior || [],
    settlement: item.raw?.settlement || [],
    settlement_extre: item.raw?.settlement_extre || [],
    waiting_round_end_action: item.raw?.waiting_round_end_action || [],
  });
  const counterRefs = [...collectCounterRefs(item.raw || {})].sort((a, b) => Number(a) - Number(b));
  const hasSlotBlock = Array.isArray(item.slots) && item.slots.length > 0;
  const hasOpenBlock = Array.isArray(item.openConditions) && item.openConditions.length > 0;
  const hasSettlementPriorBlock = hasReadableEntries(item.raw?.settlement_prior || []);
  const hasSettlementBlock = hasReadableEntries(item.raw?.settlement || []);
  const hasSettlementExtreBlock = hasReadableEntries(item.raw?.settlement_extre || []);
  const hasWaitingEndBlock = hasReadableEntries(item.raw?.waiting_round_end_action || []);
  const hasJumpBlock = hasJumpTargets(nextRites, nextEvents) || nextEndings.length > 0;
  const hasCardRefs = cardRefs.length > 0;
  const hasRandomTextBlock = Object.keys(item.randomText || {}).length > 0;
  const hasRandomTextUpBlock = Object.keys(item.randomTextUp || {}).length > 0;

  return `
    <div class="detail-pane__header">
      <h3>${renderRichTitle(item.id, item.name)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText(item.text || "无说明文本")}</p>
    <div class="pill-list">
      ${kindTagHtml("rites")}
      <span class="pill">回合数: ${item.roundNumber}</span>
      ${formatRiteAutoPills(item)}
      ${item.type ? `<span class="pill">类型: ${escapeHtml(typeLabel(item.type))}</span>` : ""}
      ${item.tagTips?.length ? `<span class="pill">${escapeHtml(formatTagTips(item.tagTips))}</span>` : ""}
    </div>
    ${
      item.tipsText?.length
        ? `
          <div class="detail-pane__section">
            <h3>提示信息</h3>
            <div class="readable-item">
              ${item.tipsText.map((text) => `<div class="readable-meta">${renderRichText(text)}</div>`).join("")}
            </div>
          </div>
        `
        : ""
    }
    ${
      hasRandomTextBlock
        ? `
          <details class="detail-pane__section">
            <summary>随机文本</summary>
            <div>${wrapScrollableSection(`<div class="readable-list">${renderRandomTextDetails(item.randomText)}</div>`)}</div>
          </details>
        `
        : ""
    }
    ${
      hasRandomTextUpBlock
        ? `
          <details class="detail-pane__section">
            <summary>随机文本加成</summary>
            <div>${wrapScrollableSection(`<div class="readable-list">${renderRandomTextUpDetails(item.randomTextUp)}</div>`)}</div>
          </details>
        `
        : ""
    }
    ${
      hasSlotBlock
        ? `
          <details class="detail-pane__section">
            <summary>卡槽规则</summary>
            <div>${wrapScrollableSection(renderSlotDetails(item.slots))}</div>
          </details>
        `
        : ""
    }
    ${
      hasOpenBlock
        ? `
          <details class="detail-pane__section">
            <summary>开放条件</summary>
            <div>${wrapScrollableSection(renderOpenConditionDetails(item.openConditions))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementBlock
        ? `
          <details class="detail-pane__section">
            <summary>结算规则</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement || [], "结算", item.settlementEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementPriorBlock
        ? `
          <details class="detail-pane__section">
            <summary>前置结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_prior || [], "前置结算", item.settlementPriorEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementExtreBlock
        ? `
          <details class="detail-pane__section">
            <summary>额外结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_extre || [], "额外结算", item.settlementExtreEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasWaitingEndBlock
        ? `
          <details class="detail-pane__section">
            <summary>仪式没有处理，自动关闭后</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.waiting_round_end_action || [], "等待结束动作", item.waitingRoundEndEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasJumpBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续跳转</summary>
            <div>${wrapScrollableSection(renderJumpSummaryWithEndings(nextRites, nextEvents, nextEndings))}</div>
          </details>
        `
        : ""
    }
    ${
      hasCardRefs
        ? `
          <details class="detail-pane__section">
            <summary>这条配置里提到的卡牌</summary>
            <div>${wrapScrollableSection(`
              <div class="readable-list">
                <div class="readable-item">
                  <strong>卡牌跳转</strong>
                  ${renderJumpList(cardRefs, "cards", { preview: true })}
                </div>
              </div>
            `)}</div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs, item.rawSource)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${rawConfigBlock(item)}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderEndingDetailHtml = (item, { includeRaw = true } = {}) => {
    ensureCommentDictionaryForItem(item);
    const endingSourceData = buildEndingSourceData(item);
    return `
    <div class="detail-pane__header">
      <h3>${renderRichTitle(item.id, item.name)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath || "over.json")}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText(item.text || "无基础描述")}</p>
    <div class="pill-list">
      ${kindTagHtml("endings")}
    </div>
    <div class="detail-pane__section">
      <div class="detail-pane__kv">
        <div class="detail-pane__card">
          <strong>基础信息</strong>
          ${renderKvRows([
            ["ID", item.id],
            ["名称", item.name],
            ["副标题", item.subName || "无"],
          ])}
        </div>
      </div>
    </div>
      ${
        endingSourceData.sourceBlocks.length
          ? `
            <details class="detail-pane__section">
              <summary>达成条件</summary>
              <div>${wrapScrollableSection(`<div class="readable-list">${endingSourceData.sourceBlocks.join("")}</div>`)}</div>
            </details>
          `
          : ""
      }
      ${
        hasEndingTextExtra(item.textExtra)
        ? `
          <details class="detail-pane__section">
            <summary>差分文本</summary>
            <div>${wrapScrollableSection(renderEndingTextExtra((item.textExtra || []).map((entry, index) => ({ ...entry, rawSnippet: item.textExtraEntries?.[index]?.rawSnippet || "", conditionEntries: item.textExtraEntries?.[index]?.conditionEntries || [] })), item.rawSource || ""))}</div>
          </details>
        `
          : ""
      }
      ${
        includeRaw
          ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${rawConfigBlock(item)}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderQuestIconHtml = (icon) => {
  if (!icon) return "无";
  const match = String(icon).match(/^cards\/(\d+)$/);
  if (!match) return escapeHtml(icon);
  const cardId = Number(match[1]);
  const cardName = resolveCardName(cardId);
  return `${escapeHtml(icon)} ${cardJumpHtml(cardId, cardName)}`;
};

const renderQuestTargetDetails = (targets = [], targetEntries = [], rawSource = "") => {
  const normalizedEntries = normalizeReadableEntries(targets, targetEntries);
  return `
    <div class="readable-list">
      ${normalizedEntries
        .map((entry, index) => {
          const conditionEntries = targetEntries[index]?.conditionEntries || [];
          const rawEntry = targetEntries[index]?.entry || parseJsoncText(targetEntries[index]?.rawSnippet || "") || {};
          const entryText = entry.text || rawEntry.text || "";
          const showCounter = entry.show_counter || entry.showCounter || rawEntry.show_counter || "";
          const counterSource = targetEntries[index]?.rawSnippet || rawSource;
          return `
              <div class="readable-item">
                <strong>目标 ${index + 1}</strong>
                ${entryText ? `<div class="readable-meta">文本：${renderRichText(entryText)}</div>` : ""}
                ${showCounter ? `<div class="readable-meta">显示计数器：${renderQuestShowCounterHtml(showCounter, counterSource)}</div>` : ""}
                ${
                  hasConditionContent(entry.condition, conditionEntries)
                    ? `
                    <div class="readable-meta">条件</div>
                    <div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: conditionEntries, rawSource: targetEntries[index]?.rawSnippet || rawSource })}</div>
                  `
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderQuestDetailHtml = (item, { includeRaw = true } = {}) => {
    ensureCommentDictionaryForItem(item);
    const counterRefs = [...collectCounterRefs(item.raw || {})].sort((a, b) => Number(a) - Number(b));
    const hasTargetBlock = hasReadableEntries(item.target);
    const targetCount = Array.isArray(item.target) ? item.target.length : 0;
    const preQuestId = normalizeQuestRefId(item.pre);
    const preQuestHtml =
      item.pre && Number(item.pre) > 0 && Number.isFinite(preQuestId)
        ? questJumpHtml(preQuestId, resolveQuestShortLabel(preQuestId))
        : "无";

    return `
      <div class="detail-pane__header">
        <h3>${renderRichTitle(item.id, item.name)}</h3>
        <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText(item.text || "无说明文本")}</p>
    <div class="pill-list">
      ${kindTagHtml("quests")}
    </div>
    <div class="detail-pane__section">
      <div class="detail-pane__kv">
        <div class="detail-pane__card">
          <strong>基础信息</strong>
          ${renderKvRowsHtml([
            ["ID", escapeHtml(textOrDash(item.id))],
            ["名称", escapeHtml(item.name || "无")],
            ["升级点", escapeHtml(textOrDash(item.upgradePoint))],
            ["目标数", escapeHtml(textOrDash(targetCount))],
            ["前置条目", preQuestHtml],
            ...(item.icon ? [["图标", renderQuestIconHtml(item.icon)]] : []),
          ])}
        </div>
        ${
          item.favourText
            ? `
              <div class="detail-pane__card">
                <strong>目标文本</strong>
                <div class="readable-item">${renderRichText(item.favourText)}</div>
              </div>
            `
            : ""
        }
      </div>
    </div>
    ${
      hasTargetBlock
        ? `
          <details class="detail-pane__section">
            <summary>达成目标</summary>
            <div>${wrapScrollableSection(renderQuestTargetDetails(item.target || [], item.targetEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs, item.rawSource)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${rawConfigBlock(item)}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderAfterStoryDetailHtml = (item, { includeRaw = true } = {}) => {
  ensureCommentDictionaryForItem(item);
  const riteIdBucket = new Set();
  const eventIdBucket = new Set();
  const { riteIds, eventIds } = collectJumpIdBuckets(item.raw || {}, item.rawSource || "");
  riteIds.forEach((id) => riteIdBucket.add(id));
  eventIds.forEach((id) => eventIdBucket.add(id));
  const nextRites = collectJumpItems([...riteIdBucket], "rites", (target) => `${target.id} · ${target.name}`);
  const nextEvents = collectJumpItems([...eventIdBucket], "events", (target) => `${target.id} · ${target.text}`);
  const nextEndings = buildEndingTargets(item.raw || {}, item.rawSource || []);
  const cardRefs = collectConditionCardRefs({
    close_condition: item.closeCondition || {},
    prior: item.prior || [],
    extra: item.extra || [],
  });
  const counterRefs = [...collectCounterRefs(item.raw || {})].sort((a, b) => Number(a) - Number(b));
  const hasCloseCondition = hasConditionContent(item.closeCondition, item.closeConditionEntries);
  const hasPriorBlock = hasReadableEntries(item.prior);
  const hasExtraBlock = hasReadableEntries(item.extra);
  const hasJumpBlock = hasJumpTargets(nextRites, nextEvents) || nextEndings.length > 0;
  const hasCardRefs = cardRefs.length > 0;

  return `
    <div class="detail-pane__header">
      <h3>${renderRichTitle(item.id, item.name)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText("后日谈配置条目")}</p>
    <div class="pill-list">
      ${kindTagHtml("afterStory")}
    </div>
    <div class="detail-pane__section">
      <div class="detail-pane__kv">
          <div class="detail-pane__card">
            <strong>基础信息</strong>
            ${renderKvRows([
              ["ID", item.id],
              ["名称", item.name || "无"],
              ...(Array.isArray(item.prior) && item.prior.length ? [["前置文本", `${item.prior.length} 条`]] : []),
              ["额外文本", Array.isArray(item.extra) ? `${item.extra.length} 条` : "0 条"],
            ])}
          </div>
        </div>
      </div>
    ${
      hasCloseCondition
        ? `
          <details class="detail-pane__section">
            <summary>关闭条件</summary>
            <div>${wrapScrollableSection(renderConditionLinesHtml(item.closeCondition, { bullets: true, rawEntries: item.closeConditionEntries || null, rawSource: item.rawSource || "" }))}</div>
          </details>
        `
        : ""
    }
    ${
      hasPriorBlock
        ? `
          <details class="detail-pane__section">
            <summary>前置文本</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.prior || [], "前置文本", item.priorEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasExtraBlock
        ? `
          <details class="detail-pane__section">
            <summary>额外文本</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.extra || [], "额外文本", item.extraEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasJumpBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续跳转</summary>
            <div>${wrapScrollableSection(renderJumpSummaryWithEndings(nextRites, nextEvents, nextEndings))}</div>
          </details>
        `
        : ""
    }
    ${
      hasCardRefs
        ? `
          <details class="detail-pane__section">
            <summary>这条配置里提到的卡牌</summary>
            <div>${wrapScrollableSection(`
              <div class="readable-list">
                <div class="readable-item">
                  <strong>卡牌跳转</strong>
                  ${renderJumpList(cardRefs, "cards", { preview: true })}
                </div>
              </div>
            `)}</div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs, item.rawSource)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${rawConfigBlock(item)}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderEventDetailHtml = (item, { includeRaw = true } = {}) => {
  ensureCommentDictionaryForItem(item);
  const { nextRites, nextEvents } = buildJumpTargets(item.raw || {}, item.rawSource || "", item.nextRiteIds || [], item.nextEventIds || []);
  const nextEndings = buildEndingTargets(item.raw || {}, item.rawSource || []);
  const cardRefs = collectConditionCardRefs({
    condition: item.raw?.condition || {},
    settlement: item.raw?.settlement || [],
    settlement_extre: item.raw?.settlement_extre || [],
  });
  const counterRefs = [...collectCounterRefs(item.raw || {})].sort((a, b) => Number(a) - Number(b));
  const triggerBlock = normalizeTriggerEntries(item.onEntries || item.on);
  const hasConditionBlock = hasConditionContent(item.condition, item.conditionEntries);
  const hasSettlementBlock = hasReadableEntries(item.raw?.settlement || []);
  const hasSettlementExtreBlock = hasReadableEntries(item.raw?.settlement_extre || []);
  const hasSettlementPriorBlock = hasReadableEntries(item.raw?.settlement_prior || []);
  const hasJumpBlock = hasJumpTargets(nextRites, nextEvents) || nextEndings.length > 0;
  const hasCardRefs = cardRefs.length > 0;

  return `
    <div class="detail-pane__header">
      <h3>${renderRichTitle(item.id, item.text)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText(item.text || "无说明文本")}</p>
    <div class="pill-list">
      ${kindTagHtml("events")}
      <span class="pill">可重复触发: ${item.isReplay ? "是" : "否"}</span>
      <span class="pill">本局开始即启动: ${item.autoStart ? "是" : "否"}</span>
      <span class="pill">启动后立即校验条件: ${item.startTrigger ? "是" : "否"}</span>
    </div>
    ${
      triggerBlock.length || hasConditionBlock
        ? `
          <details class="detail-pane__section">
            <summary>触发时机与条件</summary>
            <div>${wrapScrollableSection(`
              ${
                triggerBlock.length
                  ? `
                    <div>
                      <strong>触发时机</strong>
                      <div class="detail-sublist">${renderTriggerDetails(item.onEntries || item.on)}</div>
                    </div>
                  `
                  : ""
              }
              ${
                triggerBlock.length && hasConditionBlock
                  ? `<div style="height:10px"></div>`
                  : ""
              }
              ${
                hasConditionBlock
                  ? `
                    <div>
                      <strong>触发条件</strong>
                      <div class="detail-sublist">${renderConditionLinesHtml(item.condition, { bullets: true, rawEntries: item.conditionEntries || null, rawSource: item.rawSource || "" })}</div>
                    </div>
                  `
                  : ""
              }
            `)}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementBlock
        ? `
          <details class="detail-pane__section">
            <summary>结算规则</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement || [], "结算", item.settlementEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementExtreBlock
        ? `
          <details class="detail-pane__section">
            <summary>额外结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_extre || [], "额外结算", item.settlementExtreEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementPriorBlock
        ? `
          <details class="detail-pane__section">
            <summary>前置结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_prior || [], "前置结算", item.settlementPriorEntries || [], item.rawSource || ""))}</div>
          </details>
        `
        : ""
    }
    ${
      hasJumpBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续跳转</summary>
            <div>${wrapScrollableSection(renderJumpSummaryWithEndings(nextRites, nextEvents, nextEndings))}</div>
          </details>
        `
        : ""
    }
    ${
      hasCardRefs
        ? `
          <details class="detail-pane__section">
            <summary>这条配置里提到的卡牌</summary>
            <div>${wrapScrollableSection(`
              <div class="readable-list">
                <div class="readable-item">
                  <strong>卡牌跳转</strong>
                  ${renderJumpList(cardRefs, "cards", { preview: true })}
                </div>
              </div>
            `)}</div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs, item.rawSource)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${rawConfigBlock(item)}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderDetail = (item) => {
  if (!item) {
    detailPane.innerHTML = `<div class="detail-pane__empty">从左侧选一条配置，查看详细信息和原始对象。</div>`;
    return;
  }

  const kind = item.kind || currentTab;

  if (kind === "cards") {
    detailPane.innerHTML = renderCardDetailHtml(item);
    syncDetailToModal();
    bindJumpEvents();
    return;
  }

  if (kind === "rites") {
    detailPane.innerHTML = renderRiteDetailHtml(item);
    syncDetailToModal();
    bindJumpEvents();
    return;
  }

  if (kind === "events") {
    detailPane.innerHTML = renderEventDetailHtml(item);
    syncDetailToModal();
    bindJumpEvents();
    return;
  }

  if (kind === "endings") {
    detailPane.innerHTML = renderEndingDetailHtml(item);
    syncDetailToModal();
    bindJumpEvents();
    return;
  }

  if (kind === "afterStory") {
    detailPane.innerHTML = renderAfterStoryDetailHtml(item);
    syncDetailToModal();
    bindJumpEvents();
    return;
  }

  if (kind === "quests") {
    detailPane.innerHTML = renderQuestDetailHtml(item);
    syncDetailToModal();
    bindJumpEvents();
    return;
  }

};

const listCardTitle = (item) => {
  if (item.kind === "cards") return `${item.id} · ${item.name}`;
  if (item.kind === "rites") return `${item.id} · ${item.name}`;
  if (item.kind === "events") return `${item.id} · ${item.text}`;
  if (item.kind === "afterStory") return `${item.id} · ${item.name}`;
  if (item.kind === "quests") return `${item.id} · ${item.name}`;
  return `${item.id} · ${item.name}`;
};

const listCardTitleHtml = (item) => {
  if (item.kind === "cards") return renderRichTitle(item.id, item.name);
  if (item.kind === "rites") return renderRichTitle(item.id, item.name);
  if (item.kind === "events") return renderRichTitle(item.id, item.text);
  if (item.kind === "afterStory") return renderRichTitle(item.id, item.name);
  if (item.kind === "quests") return renderRichTitle(item.id, item.name);
  return renderRichTitle(item.id, item.name);
};

const renderExplorer = () => {
  if (cardSubtabs) {
    cardSubtabs.hidden = currentTab !== "cards";
  }
  if (riteSubtabs) {
    riteSubtabs.hidden = currentTab !== "rites";
  }
  const keyword = searchInput.value.trim();
  const items = dataForTab().filter((entry) => matches(entry, keyword));
  explorerMeta.textContent = `当前显示 ${items.length} 条`;
  explorerList.innerHTML = "";

  if (!items.some((item) => itemSelectionKey(item) === selectedKey)) {
    selectedKey = items[0] ? itemSelectionKey(items[0]) : null;
  }

    items.forEach((item) => {
      const isCard = item.kind === "cards";
      const isRite = item.kind === "rites";
      const isEvent = item.kind === "events";
      const isAfterStory = item.kind === "afterStory";
        const isQuest = item.kind === "quests";
        const material = isCard && item.type === "sudan" ? materialFromRare(item.rare) : null;
          const effectivePostRiteEntries = isCard ? (item.postRiteEntries || extractFieldArrayEntries(item.rawSource || "", "post_rite")) : [];
          const questTargetCount = isQuest ? (Array.isArray(item.target) ? item.target.length : 0) : 0;
          const questPreId = normalizeQuestRefId(item.pre);
          const questPreHtml =
            isQuest && item.pre && Number(item.pre) > 0 && Number.isFinite(questPreId)
              ? questJumpHtml(questPreId, resolveQuestShortLabel(questPreId))
              : "";
        const node = card(`
        <div class="entry-card__header">
          <h3>${listCardTitleHtml(item)}</h3>
        ${
          material
            ? `<div class="${material.className}">${material.label}</div>`
            : `<div class="entry-card__meta">${escapeHtml(item.kind === "endings" ? (item.sourcePath || "over.json") : (item.sourcePath || item.subName || ""))}</div>`
        }
      </div>
        ${item.text || item.title ? `<p>${renderRichText(item.text || item.title)}</p>` : ""}
      <div class="pill-list">
        ${
          isCard
            ? `
              <span class="pill">类型: ${escapeHtml(typeLabel(item.type))}</span>
              <span class="pill">品级: ${gradeLabel(item)}</span>
              ${((item.type === "char" || item.type === "item") && item.title) ? `<span class="pill">title: ${escapeHtml(item.title)}</span>` : ""}
              ${hasReadableEntries(effectivePostRiteEntries) ? `<span class="pill">后续规则: ${effectivePostRiteEntries.length}条</span>` : ""}
              ${formatCardVanishPills(item)}
              ${tutorialSudanIds.has(item.id) ? `<span class="tutorial-mark">教程卡</span>` : ""}
            `
            : isRite
              ? `
                <span class="pill">回合数: ${item.roundNumber}</span>
                ${formatRiteAutoPills(item)}
                ${item.tagTips?.length ? `<span class="pill">${escapeHtml(formatTagTips(item.tagTips))}</span>` : ""}
                ${item.type ? `<span class="pill">类型: ${escapeHtml(typeLabel(item.type))}</span>` : ""}
              `
                : isEvent
                  ? `
                    <span class="pill">可重复触发: ${item.isReplay ? "是" : "否"}</span>
                    <span class="pill">本局开始即启动: ${item.autoStart ? "是" : "否"}</span>
                    <span class="pill">启动后立即校验条件: ${item.startTrigger ? "是" : "否"}</span>
                  `
                  : isAfterStory
                    ? `
                      ${Array.isArray(item.prior) && item.prior.length ? `<span class="pill">前置文本: ${item.prior.length}条</span>` : ""}
                      <span class="pill">额外文本: ${Array.isArray(item.extra) ? item.extra.length : 0}条</span>
                    `
                    : isQuest
                      ? `
                        <span class="pill">目标数: ${questTargetCount}</span>
                        ${questPreHtml ? `<span class="pill">前置: ${questPreHtml}</span>` : ""}
                      `
                    : `
                    <span class="pill">结局: ${item.id}</span>
                    <span class="pill">${escapeHtml(item.subName || "无副标题")}</span>
                  `
        }
      </div>
    `);
    node.classList.toggle("is-selected", itemSelectionKey(item) === selectedKey);
    node.addEventListener("click", () => {
      selectedKey = itemSelectionKey(item);
      renderExplorer();
      openModalIfNeeded();
    });
    explorerList.appendChild(node);
  });

  renderDetail(items.find((item) => itemSelectionKey(item) === selectedKey) || null);
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((node) => node.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentTab = tab.dataset.target;
    if (currentTab !== "cards") {
      currentCardFilter = "all";
      cardSubtabsButtons.forEach((node) => node.classList.toggle("is-active", node.dataset.cardFilter === "all"));
    }
    if (currentTab !== "rites") {
      currentRiteFilter = "all";
      riteSubtabsButtons.forEach((node) => node.classList.toggle("is-active", node.dataset.riteFilter === "all"));
    }
    selectedKey = null;
    renderExplorer();
  });
});

cardSubtabsButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    cardSubtabsButtons.forEach((node) => node.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentCardFilter = tab.dataset.cardFilter;
    selectedKey = null;
    renderExplorer();
  });
});

riteSubtabsButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    riteSubtabsButtons.forEach((node) => node.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentRiteFilter = tab.dataset.riteFilter;
    selectedKey = null;
    renderExplorer();
  });
});

detailModalBackdrop?.addEventListener("click", closeDetailModal);
detailModalBack?.addEventListener("click", goBackDetailModal);
detailModalClose?.addEventListener("click", closeDetailModal);
cardPreviewBackdrop?.addEventListener("click", closeCardPreview);
cardPreviewBack?.addEventListener("click", goBackCardPreview);
cardPreviewClose?.addEventListener("click", closeCardPreview);
scrollTopBtn?.addEventListener("click", scrollToTop);
window.addEventListener("scroll", updateScrollTopButton, { passive: true });

searchInput.addEventListener("input", renderExplorer);
exactMatchInput?.addEventListener("change", renderExplorer);

const init = async () => {
  setupImportUi();
  const cachedPayload = normalizeCachedPayload(await cacheGet(CACHE_KEY));
  siteData = window.SITE_DATA || cachedPayload?.data || null;
  if (!siteData) {
    explorerMeta.textContent = "尚未导入本地配置数据";
    detailPane.innerHTML = `<div class="detail-pane__empty">先导入本地配置数据，然后从左侧选择一条配置查看详情。</div>`;
    setImportStatus("尚未导入本地配置数据。可导入 config.zip 或配置文件夹。");
    return;
  }
  indices = createIndices();
  renderSummary();
  renderExplorer();
  setImportStatus(
    window.SITE_DATA
      ? "已载入当前页面内置数据。"
      : `已从本地缓存恢复上次导入的数据${cachedPayload?.sourceLabel ? `：${cachedPayload.sourceLabel}` : ""}。`,
  );
  updateScrollTopButton();
};

init().catch((error) => {
  setupImportUi();
  explorerMeta.textContent = "站点数据加载失败";
  explorerList.innerHTML = `<article class="entry-card"><pre>${escapeHtml(String(error.stack || error))}</pre></article>`;
  setImportStatus(`初始化失败：${error.message || error}`, true);
});
