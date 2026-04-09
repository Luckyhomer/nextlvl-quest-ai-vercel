const XP_RANGES = {
  EASY: { min: 5, max: 12, stars: 1 },
  MEDIUM: { min: 12, max: 25, stars: 2 },
  HARD: { min: 25, max: 50, stars: 3 }
};

export const questBoardModelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["quests"],
  properties: {
    quests: {
      type: "array",
      minItems: 9,
      maxItems: 9,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "template_key",
          "title_ru",
          "title_en",
          "description_ru",
          "description_en",
          "xp_percent"
        ],
        properties: {
          template_key: { type: "string", minLength: 1, maxLength: 80 },
          title_ru: { type: "string", minLength: 1, maxLength: 80 },
          title_en: { type: "string", minLength: 1, maxLength: 80 },
          description_ru: { type: "string", minLength: 1, maxLength: 180 },
          description_en: { type: "string", minLength: 1, maxLength: 180 },
          xp_percent: { type: "number", minimum: 5, maximum: 50 }
        }
      }
    }
  }
};

function normalizeText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function clampXp(tier, xpPercent) {
  const range = XP_RANGES[tier];
  const numeric = typeof xpPercent === "number" ? xpPercent : Number(xpPercent);

  if (!Number.isFinite(numeric)) {
    return Number(((range.min + range.max) / 2).toFixed(1));
  }

  return Number(Math.max(range.min, Math.min(range.max, numeric)).toFixed(1));
}

function requestedLayout(payload) {
  const layout = payload?.requested_layout ?? {};
  return {
    easy: Number.isInteger(layout.easy) ? layout.easy : 3,
    medium: Number.isInteger(layout.medium) ? layout.medium : 3,
    hard: Number.isInteger(layout.hard) ? layout.hard : 3
  };
}

function templateMap(payload) {
  const templates = Array.isArray(payload?.allowed_templates) ? payload.allowed_templates : [];
  return new Map(
    templates
      .filter((template) => template && typeof template.template_key === "string" && template.template_key.trim())
      .map((template) => [template.template_key, template])
  );
}

export function sanitizeBoardFromModel(modelBoard, payload) {
  const templatesByKey = templateMap(payload);
  const inputQuests = Array.isArray(modelBoard?.quests) ? modelBoard.quests : [];
  const grouped = { EASY: [], MEDIUM: [], HARD: [] };

  for (const rawQuest of inputQuests) {
    const templateKey = typeof rawQuest?.template_key === "string" ? rawQuest.template_key.trim() : "";
    const template = templatesByKey.get(templateKey);
    if (!template) {
      continue;
    }

    const tier = template.tier;
    const range = XP_RANGES[tier];
    if (!range) {
      continue;
    }

    grouped[tier].push({
      template_key: template.template_key,
      tier,
      stars: range.stars,
      quest_type: template.type,
      title_ru: normalizeText(rawQuest?.title_ru, template.objective_ru || template.template_key),
      title_en: normalizeText(rawQuest?.title_en, template.objective_en || template.template_key),
      description_ru: normalizeText(rawQuest?.description_ru, template.objective_ru || template.template_key),
      description_en: normalizeText(rawQuest?.description_en, template.objective_en || template.template_key),
      target_id: template.target_key,
      target_count: template.target_count,
      xp_percent: clampXp(tier, rawQuest?.xp_percent)
    });
  }

  const normalizedQuests = [];
  let slot = 0;
  for (const tier of ["EASY", "MEDIUM", "HARD"]) {
    for (const quest of grouped[tier]) {
      normalizedQuests.push({ ...quest, slot });
      slot += 1;
    }
  }

  return { quests: normalizedQuests };
}

export function validateBoard(board, payload = {}) {
  if (!board || typeof board !== "object") return "Board is not an object";
  if (!Array.isArray(board.quests) || board.quests.length !== 9) return "Board must contain exactly 9 quests";

  const layout = requestedLayout(payload);
  if (layout.easy !== 3 || layout.medium !== 3 || layout.hard !== 3) {
    return `Unsupported requested_layout: ${layout.easy}/${layout.medium}/${layout.hard}. Expected 3/3/3.`;
  }

  const templatesByKey = templateMap(payload);
  if (!templatesByKey.size) {
    return "allowed_templates is empty";
  }

  const slots = new Set();
  const templateKeys = new Set();
  let easy = 0;
  let medium = 0;
  let hard = 0;

  for (const q of board.quests) {
    if (typeof q.slot !== "number" || q.slot < 0 || q.slot > 8) return `Invalid slot: ${q?.slot}`;
    if (slots.has(q.slot)) return `Duplicate slot: ${q.slot}`;
    slots.add(q.slot);

    if (typeof q.template_key !== "string" || !q.template_key.trim()) {
      return `Missing template_key in slot ${q.slot}`;
    }
    if (templateKeys.has(q.template_key)) return `Duplicate template_key: ${q.template_key}`;
    templateKeys.add(q.template_key);

    const template = templatesByKey.get(q.template_key);
    if (!template) return `Unknown template_key in slot ${q.slot}: ${q.template_key}`;

    if (q.tier !== template.tier) return `Tier mismatch for ${q.template_key} in slot ${q.slot}`;
    if (q.quest_type !== template.type) return `quest_type mismatch for ${q.template_key} in slot ${q.slot}`;
    if (q.target_id !== template.target_key) return `target_id mismatch for ${q.template_key} in slot ${q.slot}`;
    if (q.target_count !== template.target_count) return `target_count mismatch for ${q.template_key} in slot ${q.slot}`;

    if (typeof q.title_ru !== "string" || !q.title_ru.trim()) return `Missing title_ru in slot ${q.slot}`;
    if (typeof q.title_en !== "string" || !q.title_en.trim()) return `Missing title_en in slot ${q.slot}`;
    if (typeof q.description_ru !== "string" || !q.description_ru.trim()) return `Missing description_ru in slot ${q.slot}`;
    if (typeof q.description_en !== "string" || !q.description_en.trim()) return `Missing description_en in slot ${q.slot}`;

    if (q.tier === "EASY") {
      easy += 1;
      if (q.slot < 0 || q.slot > 2) return `EASY quest is in wrong slot ${q.slot}`;
      if (q.stars !== 1) return `EASY must have stars=1 in slot ${q.slot}`;
      if (q.xp_percent < 5 || q.xp_percent > 12) return `EASY xp out of range in slot ${q.slot}`;
    } else if (q.tier === "MEDIUM") {
      medium += 1;
      if (q.slot < 3 || q.slot > 5) return `MEDIUM quest is in wrong slot ${q.slot}`;
      if (q.stars !== 2) return `MEDIUM must have stars=2 in slot ${q.slot}`;
      if (q.xp_percent < 12 || q.xp_percent > 25) return `MEDIUM xp out of range in slot ${q.slot}`;
    } else if (q.tier === "HARD") {
      hard += 1;
      if (q.slot < 6 || q.slot > 8) return `HARD quest is in wrong slot ${q.slot}`;
      if (q.stars !== 3) return `HARD must have stars=3 in slot ${q.slot}`;
      if (q.xp_percent < 25 || q.xp_percent > 50) return `HARD xp out of range in slot ${q.slot}`;
    } else {
      return `Invalid tier in slot ${q.slot}: ${q.tier}`;
    }
  }

  if (easy !== 3 || medium !== 3 || hard !== 3) {
    return `Need 3 EASY, 3 MEDIUM, 3 HARD but got ${easy}/${medium}/${hard}`;
  }

  return null;
}
