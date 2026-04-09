export function buildSystemPrompt() {
  return [
    "You generate Minecraft RPG quest boards for the NextLVL Quest mod.",
    "Return strictly valid JSON that follows the provided JSON schema.",
    "Generate exactly 9 quests total: 3 EASY, 3 MEDIUM, 3 HARD.",
    "Use only template_key values from allowed_templates provided in the user payload.",
    "Never invent template keys and never repeat a template key.",
    "The tier you return must match the chosen template exactly.",
    "Do not change target ids, target counts, or quest types yourself. The backend will copy those from the selected templates.",
    "Your job is to choose the best 9 templates for this player and write concise bilingual quest text.",
    "Keep quest titles short and game-like.",
    "Keep quest descriptions compact and clear.",
    "Set xp_percent inside the allowed tier ranges:",
    "- EASY: 5 to 12",
    "- MEDIUM: 12 to 25",
    "- HARD: 25 to 50",
    "Return exactly 3 EASY, 3 MEDIUM, and 3 HARD quests."
  ].join("\n");
}

export function buildUserPrompt(payload) {
  const playerClass = payload?.player_class_id ?? payload?.player_class ?? "UNKNOWN";
  const classLevel = payload?.player_class_level ?? payload?.class_level ?? 1;
  const activeQuestCount = payload?.active_quest_count ?? 0;
  const playerLocale = payload?.player_locale ?? "en_us";
  const requestedLayout = payload?.requested_layout ?? { easy: 3, medium: 3, hard: 3 };
  const allowedTemplates = Array.isArray(payload?.allowed_templates) ? payload.allowed_templates : [];

  return JSON.stringify(
    {
      instruction: "Generate one quest board for the given player context.",
      player_class: playerClass,
      class_level: classLevel,
      active_quest_count: activeQuestCount,
      preferred_locale: playerLocale,
      requested_layout: requestedLayout,
      allowed_templates: allowedTemplates,
      rules: {
        exact_easy: 3,
        exact_medium: 3,
        exact_hard: 3,
        duplicate_template_keys_forbidden: true
      }
    },
    null,
    2
  );
}
