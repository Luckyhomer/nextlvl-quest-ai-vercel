export function buildSystemPrompt() {
  return [
    "You generate Minecraft RPG quest boards for the NextLVL Quest mod.",
    "Return strictly valid JSON that follows the provided JSON schema.",
    "Generate exactly 9 quests: slots 0-2 EASY, 3-5 MEDIUM, 6-8 HARD.",
    "Allowed quest types: KILL_MOB, COLLECT_ITEM, BREAK_BLOCK, CLASS_LEVEL.",
    "Use only safe, common vanilla Minecraft targets.",
    "Avoid impossible or biome-locked objectives unless they are broadly obtainable.",
    "Keep quest text concise and game-like.",
    "Set xp_percent inside the allowed tier ranges:",
    "- EASY: 5 to 12",
    "- MEDIUM: 12 to 25",
    "- HARD: 25 to 50",
    "Titles and descriptions must be provided in both Russian and English."
  ].join("\n");
}

export function buildUserPrompt(payload) {
  const playerClass = payload?.player_class ?? "UNKNOWN";
  const classLevel = payload?.class_level ?? 1;
  const recent = Array.isArray(payload?.recent_quests) ? payload.recent_quests : [];
  const allowedMobs = Array.isArray(payload?.allowed_mobs) && payload.allowed_mobs.length
    ? payload.allowed_mobs
    : [
        "minecraft:zombie",
        "minecraft:skeleton",
        "minecraft:spider",
        "minecraft:creeper",
        "minecraft:witch"
      ];
  const allowedItems = Array.isArray(payload?.allowed_items) && payload.allowed_items.length
    ? payload.allowed_items
    : [
        "minecraft:arrow",
        "minecraft:string",
        "minecraft:bone",
        "minecraft:coal",
        "minecraft:iron_ingot",
        "minecraft:oak_log"
      ];
  const allowedBlocks = Array.isArray(payload?.allowed_blocks) && payload.allowed_blocks.length
    ? payload.allowed_blocks
    : [
        "minecraft:coal_ore",
        "minecraft:iron_ore",
        "minecraft:oak_log",
        "minecraft:stone"
      ];

  return JSON.stringify({
    instruction: "Generate one quest board for the given player context.",
    player_class: playerClass,
    class_level: classLevel,
    recent_quests: recent,
    allowed_mobs: allowedMobs,
    allowed_items: allowedItems,
    allowed_blocks: allowedBlocks
  }, null, 2);
}
