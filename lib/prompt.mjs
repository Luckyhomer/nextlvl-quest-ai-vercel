export function buildSystemPrompt() {
  return [
    "You generate Minecraft RPG quest boards for the NextLVL Quest mod.",
    "Return strictly valid JSON that follows the provided JSON schema.",
    "Generate exactly 9 quests total: 3 EASY, 3 MEDIUM, 3 HARD.",
    "Use only template_key values from allowed_templates.",
    "Do not invent new template keys.",
    "Do not repeat template_key values.",
    "The backend will derive slot, stars, quest_type, target_id and target_count from the chosen template_key.",
    "You must provide concise titles and descriptions in both Russian and English.",
    "Set xp_percent inside the allowed tier ranges:",
    "- EASY: 5 to 12",
    "- MEDIUM: 12 to 25",
    "- HARD: 25 to 50",
    "Prefer templates appropriate for the player class and class level when possible."
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
    allowed_templates: allowedTemplates,
    response_contract: {
      quests_count: 9,
      per_quest_required_fields: [
        "template_key",
        "title_ru",
        "title_en",
        "description_ru",
        "description_en",
        "xp_percent"
      ]
    }
  }, null, 2);
}
