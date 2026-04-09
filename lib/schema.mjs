export const aiQuestSelectionSchema = {
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
          "tier",
          "template_key",
          "title_ru",
          "title_en",
          "description_ru",
          "description_en",
          "xp_percent"
        ],
        properties: {
          tier: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
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

export function validateSelection(selection, allowedTemplates = []) {
  if (!selection || typeof selection !== "object") return "Selection is not an object";
  if (!Array.isArray(selection.quests) || selection.quests.length !== 9) {
    return "Selection must contain exactly 9 quests";
  }

  const allowed = new Map();
  for (const template of allowedTemplates) {
    if (template?.template_key) allowed.set(template.template_key, template);
  }

  const seen = new Set();
  let easy = 0;
  let medium = 0;
  let hard = 0;

  for (const q of selection.quests) {
    if (!q || typeof q !== "object") return "Quest entry is not an object";
    if (!q.template_key || !allowed.has(q.template_key)) {
      return `Unknown template_key: ${q?.template_key}`;
    }
    if (seen.has(q.template_key)) {
      return `Duplicate template_key: ${q.template_key}`;
    }
    seen.add(q.template_key);

    const template = allowed.get(q.template_key);
    if (q.tier !== template.tier) {
      return `Tier mismatch for template ${q.template_key}: got ${q.tier}, expected ${template.tier}`;
    }

    if (q.tier === "EASY") easy++;
    else if (q.tier === "MEDIUM") medium++;
    else if (q.tier === "HARD") hard++;
    else return `Invalid tier: ${q.tier}`;

    if (typeof q.title_ru !== "string" || !q.title_ru.trim()) return `Missing title_ru for ${q.template_key}`;
    if (typeof q.title_en !== "string" || !q.title_en.trim()) return `Missing title_en for ${q.template_key}`;
    if (typeof q.description_ru !== "string" || !q.description_ru.trim()) return `Missing description_ru for ${q.template_key}`;
    if (typeof q.description_en !== "string" || !q.description_en.trim()) return `Missing description_en for ${q.template_key}`;

    const xp = Number(q.xp_percent);
    if (!Number.isFinite(xp)) return `Invalid xp_percent for ${q.template_key}`;
    if (q.tier === "EASY" && (xp < 5 || xp > 12)) return `EASY xp out of range for ${q.template_key}`;
    if (q.tier === "MEDIUM" && (xp < 12 || xp > 25)) return `MEDIUM xp out of range for ${q.template_key}`;
    if (q.tier === "HARD" && (xp < 25 || xp > 50)) return `HARD xp out of range for ${q.template_key}`;
  }

  if (easy !== 3 || medium !== 3 || hard !== 3) {
    return `Need 3 EASY, 3 MEDIUM, 3 HARD but got ${easy}/${medium}/${hard}`;
  }

  return null;
}

export const questBoardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["board_id", "generated_at", "expires_at", "quests"],
  properties: {
    board_id: { type: "string", minLength: 1 },
    generated_at: { type: "integer" },
    expires_at: { type: "integer" },
    quests: {
      type: "array",
      minItems: 9,
      maxItems: 9,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "slot",
          "tier",
          "stars",
          "template_key",
          "quest_type",
          "title_ru",
          "title_en",
          "description_ru",
          "description_en",
          "target_id",
          "target_count",
          "xp_percent"
        ],
        properties: {
          slot: { type: "integer", minimum: 0, maximum: 8 },
          tier: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
          stars: { type: "integer", enum: [1, 2, 3] },
          template_key: { type: "string", minLength: 1, maxLength: 80 },
          quest_type: {
            type: "string",
            enum: ["KILL_MOB", "COLLECT_ITEM", "BREAK_BLOCK", "CLASS_LEVEL"]
          },
          title_ru: { type: "string", minLength: 1, maxLength: 80 },
          title_en: { type: "string", minLength: 1, maxLength: 80 },
          description_ru: { type: "string", minLength: 1, maxLength: 180 },
          description_en: { type: "string", minLength: 1, maxLength: 180 },
          target_id: { type: "string", minLength: 1, maxLength: 80 },
          target_count: { type: "integer", minimum: 1, maximum: 128 },
          xp_percent: { type: "number", minimum: 5, maximum: 50 }
        }
      }
    }
  }
};

export function validateBoard(board) {
  if (!board || typeof board !== "object") return "Board is not an object";
  if (!Array.isArray(board.quests) || board.quests.length !== 9) return "Board must contain exactly 9 quests";

  const slots = new Set();
  let easy = 0, medium = 0, hard = 0;

  for (const q of board.quests) {
    if (typeof q.slot !== "number" || q.slot < 0 || q.slot > 8) return `Invalid slot: ${q?.slot}`;
    if (slots.has(q.slot)) return `Duplicate slot: ${q.slot}`;
    slots.add(q.slot);

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
  }

  if (easy !== 3 || medium !== 3 || hard !== 3) return `Need 3 EASY, 3 MEDIUM, 3 HARD but got ${easy}/${medium}/${hard}`;

  return null;
}
