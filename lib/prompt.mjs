export function buildSystemPrompt() {
  return [
    "You generate Minecraft RPG quest boards for the NextLVL Quest mod.",
    "Return strictly valid JSON that follows the provided JSON schema.",
    "Generate exactly 9 quests: slots 0-2 EASY, 3-5 MEDIUM, 6-8 HARD.",
    "Allowed quest types: KILL_MOB, COLLECT_ITEM, BREAK_BLOCK, CLASS_LEVEL.",
    "Every generated quest MUST use one template_key from allowed_templates provided in the user payload.",
    "template_key, tier, quest_type, target_id and target_count must match the chosen allowed template exactly.",
    "Use only templates from allowed_templates; do not invent new template keys.",
    "Keep quest text concise and game-like.",
    "Set xp_percent inside the allowed tier ranges:",
    "- EASY: 5 to 12",
    "- MEDIUM: 12 to 25",
    "- HARD: 25 to 50",
    "Titles and descriptions must be provided in both Russian and English."
  ].join("\n");
}

export function buildUserPrompt(payload) {
  const playerClass = payload?.player_class_id ?? payload?.player_class ?? "UNKNOWN";
  const classLevel = payload?.player_class_level ?? payload?.class_level ?? 1;
  const activeQuestCount = payload?.active_quest_count ?? 0;
  const requestedLayout = payload?.requested_layout ?? { easy: 3, medium: 3, hard: 3 };
  const allowedTemplates = Array.isArray(payload?.allowed_templates) ? payload.allowed_templates : [];

  return JSON.stringify({
    instruction: "Generate one quest board for the given player context.",
    player_class: playerClass,
    class_level: classLevel,
    active_quest_count: activeQuestCount,
    requested_layout: requestedLayout,
    allowed_templates: allowedTemplates
  }, null, 2);
}
