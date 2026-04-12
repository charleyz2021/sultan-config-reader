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
const detailModalClose = document.querySelector("#detailModalClose");
const detailModalContent = document.querySelector("#detailModalContent");
const cardPreview = document.querySelector("#cardPreview");
const cardPreviewBackdrop = document.querySelector("#cardPreviewBackdrop");
const cardPreviewClose = document.querySelector("#cardPreviewClose");
const cardPreviewContent = document.querySelector("#cardPreviewContent");
const scrollTopBtn = document.querySelector("#scrollTopBtn");
const appVersion = document.querySelector("#appVersion");
const hero = document.querySelector(".hero");
const pageShell = document.querySelector(".page-shell");
const translationData = window.SULTAN_TRANSLATIONS || {};
const APP_VERSION = "v0.1.1";
const APP_UPDATED_AT = "2026-04-12";

let currentTab = "all";
let currentCardFilter = "all";
let currentRiteFilter = "all";
let selectedId = null;
let siteData = null;
let indices = null;
let importStatus = null;
let zipInput = null;
let folderInput = null;
let importZipBtn = null;
let importFolderBtn = null;
let clearCacheBtn = null;

const mobileMq = window.matchMedia("(max-width: 900px)");
const CACHE_DB_NAME = "sultan-config-reader";
const CACHE_STORE_NAME = "cache";
const CACHE_KEY = "site-data";
const CACHE_SCHEMA_VERSION = 1;

const formatDateTime = (isoString) =>
  new Date(isoString).toLocaleString("zh-CN", {
    hour12: false,
  });

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
  escapeHtml(value || "").replace(
    /&lt;color=(#[0-9a-fA-F]{6,8}|[a-zA-Z]+)&gt;([\s\S]*?)&lt;\/color&gt;/g,
    (_match, color, inner) => `<span style="color:${color}">${inner}</span>`,
  );

const jsonBlock = (value) => `<pre>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2))}</pre>`;
const rawConfigBlock = (item) => jsonBlock(item?.rawSource || item?.raw || item);

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
  [...(siteData.cards || []), ...(siteData.rites || []), ...(siteData.events || []), ...(siteData.endings || [])].forEach((item) => {
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
  const quest = parseJsoncText(requireFile("quest.json"));
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
    const nextEventIds = new Set();
    const nextRiteIds = new Set();
    const prompts = [];
    const rawSlotEntries = extractRepeatedObjectEntries(raw, "cards_slot");
    const rawOpenConditionEntries = extractFieldArrayEntries(raw, "open_conditions");
    collectIdsFromObject(data, "event_on", nextEventIds);
    collectIdsFromObject(data, "rite", nextRiteIds);
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
      nextEventIds: [...nextEventIds].filter(Number.isFinite).sort((a, b) => a - b),
      nextRiteIds: [...nextRiteIds].filter(Number.isFinite).sort((a, b) => a - b),
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
    const nextEventIds = new Set();
    const nextRiteIds = new Set();
    const prompts = [];
    collectIdsFromObject(data, "event_on", nextEventIds);
    collectIdsFromObject(data, "rite", nextRiteIds);
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
      nextEventIds: [...nextEventIds].filter(Number.isFinite).sort((a, b) => a - b),
      nextRiteIds: [...nextRiteIds].filter(Number.isFinite).sort((a, b) => a - b),
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

  return {
    generatedAt: new Date().toISOString(),
    commentDictionary: createEmptyCommentDictionary(rootPrefix),
    summary: {
      riteCount: riteSummaries.length,
      eventCount: eventSummaries.length,
      endingCount: endingSummaries.length,
      afterStoryCount: afterStoryFiles.length,
      totalCardCount: cardSummaries.length,
      sudanCardCount: cardSummaries.filter((item) => item.type === "sudan").length,
      initModeCount: 0,
    },
    cards: cardSummaries,
    rites: riteSummaries,
    events: eventSummaries,
    endings: endingSummaries,
    afterStory: afterStoryFiles.map(({ data, path: sourcePath }) => ({
      id: data.id,
      name: data.name || "",
      sourcePath,
      extraCount: Array.isArray(data.extra) ? data.extra.length : 0,
    })),
    questPreview: Object.values(quest)
      .slice(0, 80)
      .map((value) => ({
        id: value.id,
        name: value.name,
        text: value.text,
      })),
  };
};

const jumpTo = (tab, id) => {
  const tabButton = tabs.find((node) => node.dataset.target === tab);
  if (!tabButton) return;
  tabs.forEach((node) => node.classList.remove("is-active"));
  tabButton.classList.add("is-active");
  currentTab = tab;
  selectedId = Number(id);
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

const collectConditionCardRefs = (value) =>
  [...collectNumericRefs(value)]
    .map((id) => {
      const target = indices.cards.get(id);
      return target ? { id, label: `${id} · ${target.name}` } : null;
    })
    .filter(Boolean);

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

const renderCounterReferenceSection = (ids) => {
  if (!ids?.length) return "";
  ensureGlobalCounterCommentDictionary();
  return `
    <details class="detail-pane__section">
      <summary>这条配置里提到的计数器</summary>
      <div class="readable-list">
        <div class="readable-item">
          <strong>计数器对照</strong>
          <div class="kv-list">
            ${ids
              .map((id) => {
                const label = resolveCounterLabel(id);
                return `
                  <div class="kv-row">
                    <dt>#${escapeHtml(String(id))}</dt>
                    <dd>${escapeHtml(label || "未整理")}</dd>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
    </details>
  `;
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

const resolveRiteName = (id) => indices?.rites?.get(Number(id))?.name || getCommentRiteMap()[String(id)] || `ID ${id}`;
const resolveEventName = (id) => indices?.events?.get(Number(id))?.text || getCommentEventMap()[String(id)] || `ID ${id}`;
const resolveEndingName = (id) => indices?.endings?.get(Number(id))?.name || `ID ${id}`;
const resolveCardName = (id) => {
  const target = indices?.cards?.get(Number(id));
  return target?.name || entityDisplayNameMap[Number(id)] || getCommentCardMap()[String(id)] || `ID ${id}`;
};

const resolveCardTargetByToken = (rawToken) => {
  const token = String(rawToken);
  const aliasId = entityAliasMap[token];
  if (aliasId && indices?.cards?.has(aliasId)) {
    return indices.cards.get(aliasId);
  }
  const numericId = Number(token);
  if (Number.isFinite(numericId) && indices?.cards?.has(numericId)) {
    return indices.cards.get(numericId);
  }
  return (
    siteData?.cards?.find((item) => item.name === token) ||
    null
  );
};

const entityRefHtml = (rawToken) => {
  const target = resolveCardTargetByToken(rawToken);
  if (target) {
    return cardJumpHtml(target.id, target.name);
  }
  return `<strong>${escapeHtml(String(rawToken))}</strong>`;
};

const entityLabelHtml = (rawId) => {
  const id = Number(rawId);
  if (Number.isFinite(id) && indices?.cards?.has(id)) {
    return cardJumpHtml(id, resolveCardName(id));
  }
  const target = resolveCardTargetByToken(rawId);
  if (target) {
    return cardJumpHtml(target.id, target.name);
  }
  return escapeHtml(String(rawId));
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

const counterRuleText = (scope, name, operator, value) => {
  const scopeLabel = scope === "global_counter" ? "全局计数器" : "计数器";
  const stringName = String(name);
  const readableValue = valueToReadableText(value);
  if (/^\d+$/.test(stringName)) {
    return `${scopeLabel} #${stringName}${operator || "="}${readableValue}`;
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

const summarizeMutationEntries = (action = {}, prefix = "动作") => {
  const entries = [];
  const actionEntries = normalizeMutationEntries(action);
  const riteIds = actionEntries.filter((entry) => entry.key === "rite").flatMap((entry) => collectIdsFromValue(entry.value));
  const eventIds = actionEntries.filter((entry) => entry.key === "event_on").flatMap((entry) => collectIdsFromValue(entry.value));
  const endingIds = actionEntries.filter((entry) => entry.key === "over").flatMap((entry) => collectIdsFromValue(entry.value));

  if (riteIds.length) {
    const labels = riteIds.map((id) => riteJumpHtml(id, resolveRiteName(id)));
    entries.push(`${prefix}：出现仪式：${labels.join(" / ")}`);
  }

  if (eventIds.length) {
    const labels = eventIds.map((id) => eventJumpHtml(id, resolveEventName(id)));
    entries.push(`${prefix}：出现事件：${labels.join(" / ")}`);
  }

  if (endingIds.length) {
    const labels = endingIds.map((id) => endingJumpHtml(id, resolveEndingName(id)));
    entries.push(`${prefix}：进入结局：${labels.join(" / ")}`);
  }

  const mutationRuleHandlers = [
    {
      match: ({ key }) => key === "rite" || key === "event_on" || key === "over",
      apply: () => null,
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
        return `${prefix}：${scope === "global_counter" ? "全局计数器" : "计数器"} ${readableCounterName(name)} ${op === "+" ? "增加" : "减少"} ${valueToReadableText(value)}`;
      },
    },
    {
      match: ({ key }) => /^(global_counter|counter)=(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, scope, name] = key.match(/^(global_counter|counter)=(.+)$/);
        return `${prefix}：${scope === "global_counter" ? "全局计数器" : "计数器"} ${readableCounterName(name)} 设为 ${valueToReadableText(value)}`;
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
      match: ({ key }) => key === "event_off",
      apply: ({ value }) => `${prefix}：关闭事件：${value} · ${resolveEventName(value)}`,
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
      match: ({ key }) => /^case:op\d+$/.test(key),
      apply: ({ key }) => `${prefix}：设置分支选项 ${key.split(":")[1]}`,
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
      match: ({ key }) => /^table\.(\d+|[^.]+)-(.+)$/.test(key),
      apply: ({ key, value }) => {
        const [, target, token] = key.match(/^table\.(\d+|[^.]+)-(.+)$/);
        return `${prefix}：table.${entityRefHtml(target)}的${escapeHtml(token)}-${escapeHtml(valueToReadableText(value))}`;
      },
    },
    {
      match: ({ key }) => key.startsWith("table."),
      apply: ({ key, value }) => {
        const target = key.slice("table.".length).replaceAll(".uprare", ".品级提升");
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
  collectNumericRefs(value, ids);
  return [...ids].filter(Number.isFinite).sort((a, b) => a - b);
};

const renderActionResultNotes = (entry, rawMeta = {}) => {
  const blocks = [];
  if (entry.result_text) {
    blocks.push(`<div class="readable-meta">文本：${escapeHtml(entry.result_text)}</div>`);
  }
  const mergedResultEntries = mergeMutationEntries(rawMeta.resultEntries || [], entry.result || {});
  const resultLines = summarizeMutationEntries(mergedResultEntries, "结果");
  if (resultLines.length) {
    blocks.push(
      `<div class="readable-meta"><strong>结果</strong></div>${resultLines
        .map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^结果：/, "")}</div>`)
        .join("")}`,
    );
  }
  const mergedActionEntries = mergeMutationEntries(rawMeta.actionEntries || [], entry.action || {});
  const actionLines = summarizeMutationEntries(mergedActionEntries, "动作");
  if (actionLines.length) {
    blocks.push(
      `<div class="readable-meta"><strong>动作</strong></div>${actionLines
        .map((line) => `<div class="readable-meta detail-sublist">${line.replace(/^动作：/, "")}</div>`)
        .join("")}`,
    );
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
        ? `<div class="readable-meta">触发条件</div><div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: rawMeta.conditionEntries || null })}</div>`
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

const renderSettlementReadable = (entries, fallbackTitle, rawEntries = []) =>
  renderReadableEntries(normalizeReadableEntries(entries, rawEntries), ({ entry, rawMeta }, index) =>
    renderResultActionBlock(entry, `${fallbackTitle} ${index + 1}`, rawMeta),
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

const conditionRuleHtml = (key, value) => {
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
    [/^s(\d+)\.is$/, (slotId) => noWrapHtml(`s${slotId}是：${entityLabelHtml(value)}`)],
    [/^s(\d+)\.type$/, (slotId) => `s${slotId}的类型是${escapeHtml(typeLabel(value))}`],
    [/^s(\d+)\.rare(>=|<=|>|<|=)$/, (slotId, operator) => `s${slotId}的品级${operator === "=" ? "=" : operator}${escapeHtml(materialFromRare(Number(value)).label)}`],
    [/^s(\d+)\.图片$/, (slotId) => `s${slotId}替换过立绘`],
    [/^s(\d+)\.uprare$/, (slotId) => `s${slotId}的品级提升：${escapeHtml(valueToReadableText(value))}`],
    [/^rare(>=|<=|>|<|=)$/, (operator) => `品级${operator === "=" ? "=" : operator}${escapeHtml(materialFromRare(Number(value)).label)}`],
    [/^s(\d+)\.(.+)$/, (slotId, token) => noWrapHtml(`s${slotId}的${entityRefHtml(token)}：${escapeHtml(valueToReadableText(value))}`)],
  ];

  for (const [pattern, formatter] of regexHandlers) {
    const match = key.match(pattern);
    if (match) return formatter(...match.slice(1));
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
    return `${escapeHtml(left)}${operator} ${escapeHtml(valueToReadableText(normalizedValue))}`;
  }
  const costMatch = key.match(/^cost\.(.+?)(>=|<=|>|<|=)$/);
  if (costMatch) {
    const [, name, operator] = costMatch;
    return `cost.${escapeHtml(name)}${operator === "=" ? "=" : operator}${escapeHtml(valueToReadableText(value))}`;
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
    [/^!rite$/, () => `场上无仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^rite$/, () => `场上有仪式：${riteJumpHtml(value, resolveRiteName(value))}`],
    [/^counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => counterRuleText("counter", name, operator, value)],
    [/^!counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => `不满足：${counterRuleText("counter", name, operator, value)}`],
    [/^global_counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => counterRuleText("global_counter", name, operator, value)],
    [/^!global_counter\.(.+?)(>=|<=|>|<|=)?$/, (name, operator = "") => `不满足：${counterRuleText("global_counter", name, operator, value)}`],
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
      <div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: entry.conditionEntries || null })}</div>
    </div>
  `);

const renderConditionLinesHtml = (condition, { bullets = true, rawEntries = null } = {}) =>
  `<div class="condition-list">${conditionLines(condition, 0, rawEntries)
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
      <div class="detail-sublist">${renderConditionLinesHtml(slot.condition || {}, { bullets: false, rawEntries: slot.conditionEntries || null })}</div>
      <div class="readable-meta readable-meta--slot-footer">
        可空：${slot.isEmptyAllowed ? "是" : "否"}，敌对槽位：${slot.isEnemy ? "是" : "否"}${slot.openAdsorb ? "，开启吸入：是" : ""}
      </div>
    </div>
  `);

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

const conditionLines = (node, depth = 0, rawEntries = null) => {
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
        ...conditionLines(value, depth + 1, rawValueSnippet ? extractObjectEntriesFromSnippet(rawValueSnippet) : null),
      ];
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return [
        { depth, html: `${escapeHtml(key)}：` },
        ...conditionLines(value, depth + 1, rawValueSnippet ? extractObjectEntriesFromSnippet(rawValueSnippet) : null),
      ];
    }
    return [{ depth, html: conditionRuleHtml(key, value) }];
  });
};

const renderConditionDetails = (condition) => renderConditionLinesHtml(condition, { bullets: true });

const renderJumpSummary = (rites, events) => `
  <div class="readable-list">
    <div class="readable-item">
      <strong>仪式跳转</strong>
      ${renderJumpList(rites, "rites", { preview: true })}
    </div>
    <div class="readable-item">
      <strong>事件跳转</strong>
      ${renderJumpList(events, "events", { preview: true })}
    </div>
  </div>
`;

const wrapScrollableSection = (html) => `<div class="detail-scrollbox">${html}</div>`;
const hasReadableEntries = (entries) => Array.isArray(entries) && entries.length > 0;
const hasJumpTargets = (rites, events, prompts = []) =>
  (Array.isArray(rites) && rites.length > 0) ||
  (Array.isArray(events) && events.length > 0) ||
  (Array.isArray(prompts) && prompts.length > 0);
const hasEndingTextExtra = (entries) =>
  Array.isArray(entries) &&
  entries.some((entry) => entry && typeof entry === "object" && (entry.result_text || hasConditionContent(entry.condition, entry.conditionEntries)));
const renderEndingTextExtra = (entries) =>
  renderReadableEntries(entries, (entry, index) => `
    <div class="readable-item">
      <strong>${escapeHtml(entry.result_title || `差分 ${index + 1}`)}</strong>
      ${
        hasConditionContent(entry.condition, entry.conditionEntries)
          ? `<div class="readable-meta">触发条件</div><div class="detail-sublist">${renderConditionLinesHtml(entry.condition || {}, { bullets: true, rawEntries: entry.conditionEntries || null })}</div>`
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
  detailModal.hidden = false;
  document.body.style.overflow = "hidden";
};

const renderPreviewHtml = (tab, id) => {
  if (tab === "cards") {
    const item = indices?.cards?.get(Number(id));
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
  return "";
};

const openEntityPreview = (tab, id) => {
  const previewHtml = renderPreviewHtml(tab, id);
  if (!previewHtml) return;

  if (mobileMq.matches) {
    if (!detailModal || !detailModalContent) return;
    detailModalContent.innerHTML = previewHtml;
    detailModal.hidden = false;
    document.body.style.overflow = "hidden";
    bindJumpEventsIn(detailModalContent);
    return;
  }

  if (!cardPreview || !cardPreviewContent) return;
  cardPreviewContent.innerHTML = previewHtml;
  cardPreview.hidden = false;
  bindJumpEventsIn(cardPreviewContent);
};

const closeCardPreview = () => {
  if (!cardPreview) return;
  cardPreview.hidden = true;
};

const closeDetailModal = () => {
  if (!detailModal) return;
  detailModal.hidden = true;
  document.body.style.overflow = "";
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
  }
};

const bindJumpEventsIn = (root) => {
  root?.querySelectorAll(".jump").forEach((button) => {
    button.addEventListener("click", () => {
      if (
        button.dataset.preview === "card" ||
        button.dataset.preview === "rite" ||
        button.dataset.preview === "event" ||
        button.dataset.preview === "ending"
      ) {
        openEntityPreview(button.dataset.tab, button.dataset.id);
        return;
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
  detailModalClose && (detailModalClose.textContent = "关闭");
  document.querySelector(".card-preview__title")?.replaceChildren(document.createTextNode("条目预览"));
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
    ["仪式", siteData.summary.riteCount],
    ["事件", siteData.summary.eventCount],
    ["结局", siteData.summary.endingCount],
    ["后日谈", siteData.summary.afterStoryCount],
    ["全部卡牌", siteData.summary.totalCardCount],
    ["苏丹卡", siteData.summary.sudanCardCount],
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
  push(entry.sourcePath);
  push(entry.kind);
  push(
    {
      cards: "卡牌",
      rites: "仪式",
      events: "事件",
      endings: "结局",
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
      <h3>${escapeHtml(`${item.id} · ${item.name}`)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${escapeHtml(item.text || "无说明文本")}</p>
    <div class="pill-list">
      <span class="pill">类型: ${escapeHtml(typeLabel(item.type))}</span>
      <span class="pill">品级: ${escapeHtml(gradeLabel(item))}</span>
      ${showTitlePill ? `<span class="pill">title: ${escapeHtml(item.title)}</span>` : ""}
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
    ${renderCounterReferenceSection(counterRefs)}
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
  const nextRites = collectJumpItems(item.nextRiteIds, "rites", (target) => `${target.id} · ${target.name}`);
  const nextEvents = collectJumpItems(item.nextEventIds, "events", (target) => `${target.id} · ${target.text}`);
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
  const hasJumpBlock = hasJumpTargets(nextRites, nextEvents, item.prompts);
  const hasCardRefs = cardRefs.length > 0;

  return `
    <div class="detail-pane__header">
      <h3>${escapeHtml(`${item.id} · ${item.name}`)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${renderRichText(item.text || "无说明文本")}</p>
    <div class="pill-list">
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
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement || [], "结算", item.settlementEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementPriorBlock
        ? `
          <details class="detail-pane__section">
            <summary>前置结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_prior || [], "前置结算", item.settlementPriorEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementExtreBlock
        ? `
          <details class="detail-pane__section">
            <summary>额外结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_extre || [], "额外结算", item.settlementExtreEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasWaitingEndBlock
        ? `
          <details class="detail-pane__section">
            <summary>仪式没有处理，自动关闭后</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.waiting_round_end_action || [], "等待结束动作", item.waitingRoundEndEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasJumpBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续跳转</summary>
            <div>${renderJumpSummary(nextRites, nextEvents)}</div>
          </details>
        `
        : ""
    }
    ${
      hasCardRefs
        ? `
          <details class="detail-pane__section">
            <summary>这条配置里提到的卡牌</summary>
            <div class="readable-list">
              <div class="readable-item">
                <strong>卡牌跳转</strong>
                ${renderJumpList(cardRefs, "cards", { preview: true })}
              </div>
            </div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${wrapScrollableSection(rawConfigBlock(item))}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderEndingDetailHtml = (item, { includeRaw = true } = {}) => {
  ensureCommentDictionaryForItem(item);
  const counterRefs = [...collectCounterRefs(item.raw || {})].sort((a, b) => Number(a) - Number(b));
  return `
    <div class="detail-pane__header">
      <h3>${escapeHtml(`${item.id} · ${item.name}`)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath || "over.json")}</div>
    </div>
    <p class="detail-pane__summary">${escapeHtml(item.text || "无基础描述")}</p>
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
      hasEndingTextExtra(item.textExtra)
        ? `
          <details class="detail-pane__section">
            <summary>差分文本</summary>
            <div>${wrapScrollableSection(renderEndingTextExtra((item.textExtra || []).map((entry, index) => ({ ...entry, conditionEntries: item.textExtraEntries?.[index]?.conditionEntries || [] }))))}</div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${wrapScrollableSection(rawConfigBlock(item))}</div>
          </details>
        `
        : ""
    }
  `;
};

const renderEventDetailHtml = (item, { includeRaw = true } = {}) => {
  ensureCommentDictionaryForItem(item);
  const nextRites = collectJumpItems(item.nextRiteIds, "rites", (target) => `${target.id} · ${target.name}`);
  const nextEvents = collectJumpItems(item.nextEventIds, "events", (target) => `${target.id} · ${target.text}`);
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
  const hasJumpBlock = hasJumpTargets(nextRites, nextEvents, item.prompts);
  const hasCardRefs = cardRefs.length > 0;

  return `
    <div class="detail-pane__header">
      <h3>${escapeHtml(`${item.id} · ${item.text}`)}</h3>
      <div class="entry-card__meta">${escapeHtml(item.sourcePath)}</div>
    </div>
    <p class="detail-pane__summary">${escapeHtml(item.text || "无说明文本")}</p>
    <div class="pill-list">
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
                      <div class="detail-sublist">${renderConditionLinesHtml(item.condition, { bullets: true, rawEntries: item.conditionEntries || null })}</div>
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
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement || [], "结算", item.settlementEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementExtreBlock
        ? `
          <details class="detail-pane__section">
            <summary>额外结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_extre || [], "额外结算", item.settlementExtreEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasSettlementPriorBlock
        ? `
          <details class="detail-pane__section">
            <summary>前置结算</summary>
            <div>${wrapScrollableSection(renderSettlementReadable(item.raw?.settlement_prior || [], "前置结算", item.settlementPriorEntries || []))}</div>
          </details>
        `
        : ""
    }
    ${
      hasJumpBlock
        ? `
          <details class="detail-pane__section">
            <summary>后续跳转</summary>
            <div>${wrapScrollableSection(`
              ${renderJumpSummary(nextRites, nextEvents)}
              ${
                item.prompts?.length
                  ? `<div style="height:10px"></div><div class="readable-item"><strong>提示文本</strong>${renderReadableEntries(
                      item.prompts,
                      (prompt) => `<div class="readable-item"><div class="readable-meta">${escapeHtml(prompt)}</div></div>`,
                    )}</div>`
                  : ""
              }
            `)}</div>
          </details>
        `
        : ""
    }
    ${
      hasCardRefs
        ? `
          <details class="detail-pane__section">
            <summary>这条配置里提到的卡牌</summary>
            <div class="readable-list">
              <div class="readable-item">
                <strong>卡牌跳转</strong>
                ${renderJumpList(cardRefs, "cards", { preview: true })}
              </div>
            </div>
          </details>
        `
        : ""
    }
    ${renderCounterReferenceSection(counterRefs)}
    ${
      includeRaw
        ? `
          <details class="detail-pane__section">
            <summary>原始配置</summary>
            <div>${wrapScrollableSection(rawConfigBlock(item))}</div>
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

};

const listCardTitle = (item) => {
  if (item.kind === "cards") return `${item.id} · ${item.name}`;
  if (item.kind === "rites") return `${item.id} · ${item.name}`;
  if (item.kind === "events") return `${item.id} · ${item.text}`;
  return `${item.id} · ${item.name}`;
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

  if (!items.some((item) => item.id === selectedId)) {
    selectedId = items[0]?.id ?? null;
  }

  items.forEach((item) => {
    const isCard = item.kind === "cards";
    const isRite = item.kind === "rites";
    const isEvent = item.kind === "events";
    const material = isCard && item.type === "sudan" ? materialFromRare(item.rare) : null;
    const node = card(`
      <div class="entry-card__header">
        <h3>${escapeHtml(listCardTitle(item))}</h3>
        ${
          material
            ? `<div class="${material.className}">${material.label}</div>`
            : `<div class="entry-card__meta">${escapeHtml(item.kind === "endings" ? (item.sourcePath || "over.json") : (item.sourcePath || item.subName || ""))}</div>`
        }
      </div>
      <p>${escapeHtml(item.text || item.title || "无说明文本")}</p>
      <div class="pill-list">
        ${
          isCard
            ? `
              <span class="pill">类型: ${escapeHtml(typeLabel(item.type))}</span>
              <span class="pill">品级: ${gradeLabel(item)}</span>
              ${((item.type === "char" || item.type === "item") && item.title) ? `<span class="pill">title: ${escapeHtml(item.title)}</span>` : ""}
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
                : `
                  <span class="pill">结局: ${item.id}</span>
                  <span class="pill">${escapeHtml(item.subName || "无副标题")}</span>
                `
        }
      </div>
    `);
    node.classList.toggle("is-selected", item.id === selectedId);
    node.addEventListener("click", () => {
      selectedId = item.id;
      renderExplorer();
      openModalIfNeeded();
    });
    explorerList.appendChild(node);
  });

  renderDetail(items.find((item) => item.id === selectedId) || null);
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
    selectedId = null;
    renderExplorer();
  });
});

cardSubtabsButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    cardSubtabsButtons.forEach((node) => node.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentCardFilter = tab.dataset.cardFilter;
    selectedId = null;
    renderExplorer();
  });
});

riteSubtabsButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    riteSubtabsButtons.forEach((node) => node.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentRiteFilter = tab.dataset.riteFilter;
    selectedId = null;
    renderExplorer();
  });
});

detailModalBackdrop?.addEventListener("click", closeDetailModal);
detailModalClose?.addEventListener("click", closeDetailModal);
cardPreviewBackdrop?.addEventListener("click", closeCardPreview);
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
