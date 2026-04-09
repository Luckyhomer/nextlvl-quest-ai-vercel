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
