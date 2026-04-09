const TIER_ORDER = ["EASY", "MEDIUM", "HARD"];
const TIER_RANGES = {
  EASY: { min: 5, max: 12, stars: 1 },
  MEDIUM: { min: 12, max: 25, stars: 2 },
  HARD: { min: 25, max: 50, stars: 3 }
};

function normalizeString(value, fallback) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function clampXp(tier, value) {
  const range = TIER_RANGES[tier] ?? TIER_RANGES.EASY;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return range.min;
  return Math.max(range.min, Math.min(range.max, Math.round(numeric * 10) / 10));
}

function normalizeTemplate(template) {
  if (!template || typeof template !== "object") return null;
  const tier = typeof template.tier === "string" ? template.tier.trim().toUpperCase() : "";
  if (!TIER_RANGES[tier]) return null;
  const templateKey = typeof template.template_key === "string" ? template.template_key.trim() : "";
  if (!templateKey) return null;
  return {
    template_key: templateKey,
    tier,
    type: normalizeString(template.type, "COLLECT_ITEM"),
    target_key: normalizeString(template.target_key, "minecraft:stone"),
    target_count: Number.isFinite(Number(template.target_count)) ? Math.max(1, Math.round(Number(template.target_count))) : 1,
    objective_ru: normalizeString(template.objective_ru, templateKey),
    objective_en: normalizeString(template.objective_en, templateKey),
    xp_min: Number.isFinite(Number(template.xp_min)) ? Number(template.xp_min) : TIER_RANGES[tier].min,
    xp_max: Number.isFinite(Number(template.xp_max)) ? Number(template.xp_max) : TIER_RANGES[tier].max
  };
}

function indexTemplates(allowedTemplates) {
  const byKey = new Map();
  const byTier = { EASY: [], MEDIUM: [], HARD: [] };

  for (const raw of Array.isArray(allowedTemplates) ? allowedTemplates : []) {
    const template = normalizeTemplate(raw);
    if (!template || byKey.has(template.template_key)) continue;
    byKey.set(template.template_key, template);
    byTier[template.tier].push(template);
  }

  return { byKey, byTier };
}

function normalizeAiQuest(entry, byKey) {
  if (!entry || typeof entry !== "object") return null;

  const templateKey = typeof entry.template_key === "string" ? entry.template_key.trim() : "";
  if (!templateKey || !byKey.has(templateKey)) return null;

  const template = byKey.get(templateKey);
  const requestedTier = typeof entry.tier === "string" ? entry.tier.trim().toUpperCase() : template.tier;
  if (requestedTier !== template.tier) return null;

  return {
    template,
    tier: template.tier,
    xp_percent: clampXp(template.tier, entry.xp_percent),
    title_ru: normalizeString(entry.title_ru, template.objective_ru),
    title_en: normalizeString(entry.title_en, template.objective_en),
    description_ru: normalizeString(entry.description_ru, template.objective_ru),
    description_en: normalizeString(entry.description_en, template.objective_en)
  };
}

function baseQuestFromTemplate(template, overrides = {}) {
  const tierMeta = TIER_RANGES[template.tier];
  return {
    tier: template.tier,
    stars: tierMeta.stars,
    template_key: template.template_key,
    quest_type: template.type,
    title_ru: normalizeString(overrides.title_ru, template.objective_ru),
    title_en: normalizeString(overrides.title_en, template.objective_en),
    description_ru: normalizeString(overrides.description_ru, template.objective_ru),
    description_en: normalizeString(overrides.description_en, template.objective_en),
    target_id: template.target_key,
    target_count: template.target_count,
    xp_percent: clampXp(template.tier, overrides.xp_percent ?? ((template.xp_min + template.xp_max) / 2))
  };
}

export function extractJsonObject(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Model returned empty text");
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    const fenced = fenceMatch[1].trim();
    if (fenced.startsWith("{") && fenced.endsWith("}")) return fenced;
  }

  const start = trimmed.indexOf("{");
  if (start < 0) throw new Error("No JSON object found in model response");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }

  throw new Error("Unterminated JSON object in model response");
}

export function buildBoardFromAiResult(payload, aiData) {
  const { byKey, byTier } = indexTemplates(payload?.allowed_templates);
  const aiQuests = Array.isArray(aiData?.quests) ? aiData.quests : [];
  const pickedKeys = new Set();
  const finalQuests = [];

  for (const tier of TIER_ORDER) {
    const selected = [];

    for (const raw of aiQuests) {
      const normalized = normalizeAiQuest(raw, byKey);
      if (!normalized || normalized.tier !== tier) continue;
      if (pickedKeys.has(normalized.template.template_key)) continue;
      selected.push(baseQuestFromTemplate(normalized.template, normalized));
      pickedKeys.add(normalized.template.template_key);
      if (selected.length === 3) break;
    }

    if (selected.length < 3) {
      for (const template of byTier[tier]) {
        if (pickedKeys.has(template.template_key)) continue;
        selected.push(baseQuestFromTemplate(template));
        pickedKeys.add(template.template_key);
        if (selected.length === 3) break;
      }
    }

    if (selected.length < 3) {
      throw new Error(`Not enough allowed_templates for tier ${tier}`);
    }

    finalQuests.push(...selected);
  }

  return {
    board_id: typeof payload?.board_key === "string" && payload.board_key.trim()
      ? payload.board_key.trim()
      : undefined,
    quests: finalQuests.map((quest, index) => ({ ...quest, slot: index }))
  };
}

export function validateBoard(board) {
  if (!board || typeof board !== "object") return "Board is not an object";
  if (!Array.isArray(board.quests) || board.quests.length !== 9) return "Board must contain exactly 9 quests";

  const slots = new Set();
  const templateKeys = new Set();
  let easy = 0;
  let medium = 0;
  let hard = 0;

  for (const q of board.quests) {
    if (typeof q.slot !== "number" || q.slot < 0 || q.slot > 8) return `Invalid slot: ${q?.slot}`;
    if (slots.has(q.slot)) return `Duplicate slot: ${q.slot}`;
    slots.add(q.slot);

    if (!q.template_key || templateKeys.has(q.template_key)) return `Duplicate or missing template_key in slot ${q.slot}`;
    templateKeys.add(q.template_key);

    if (q.tier === "EASY") easy++;
    else if (q.tier === "MEDIUM") medium++;
    else if (q.tier === "HARD") hard++;
    else return `Invalid tier in slot ${q.slot}: ${q.tier}`;

    if (q.tier === "EASY" && q.stars !== 1) return `EASY must have stars=1 in slot ${q.slot}`;
    if (q.tier === "MEDIUM" && q.stars !== 2) return `MEDIUM must have stars=2 in slot ${q.slot}`;
    if (q.tier === "HARD" && q.stars !== 3) return `HARD must have stars=3 in slot ${q.slot}`;

    if (q.tier === "EASY" && (q.xp_percent < 5 || q.xp_percent > 12)) return `EASY xp out of range in slot ${q.slot}`;
    if (q.tier === "MEDIUM" && (q.xp_percent < 12 || q.xp_percent > 25)) return `MEDIUM xp out of range in slot ${q.slot}`;
    if (q.tier === "HARD" && (q.xp_percent < 25 || q.xp_percent > 50)) return `HARD xp out of range in slot ${q.slot}`;

    if (typeof q.title_ru !== "string" || !q.title_ru.trim()) return `Missing title_ru in slot ${q.slot}`;
    if (typeof q.title_en !== "string" || !q.title_en.trim()) return `Missing title_en in slot ${q.slot}`;
    if (typeof q.description_ru !== "string" || !q.description_ru.trim()) return `Missing description_ru in slot ${q.slot}`;
    if (typeof q.description_en !== "string" || !q.description_en.trim()) return `Missing description_en in slot ${q.slot}`;
    if (typeof q.target_id !== "string" || !q.target_id.trim()) return `Missing target_id in slot ${q.slot}`;
    if (!Number.isInteger(q.target_count) || q.target_count < 1) return `Invalid target_count in slot ${q.slot}`;
    if (typeof q.quest_type !== "string" || !q.quest_type.trim()) return `Missing quest_type in slot ${q.slot}`;
  }

  if (easy !== 3 || medium !== 3 || hard !== 3) {
    return `Need 3 EASY, 3 MEDIUM, 3 HARD but got ${easy}/${medium}/${hard}`;
  }

  return null;
}
