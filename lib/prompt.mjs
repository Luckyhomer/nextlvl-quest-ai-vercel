export function buildSystemPrompt() {
  return [
    "You generate Minecraft RPG quest boards for the NextLVL Quest mod.",
    "Return only a single valid JSON object and no markdown.",
    "Do not wrap the JSON in triple backticks.",
    "You must choose quests only from allowed_templates provided by the user.",
    "Never invent template_key values.",
    "The JSON object must have exactly one property: quests.",
    "quests must be an array with exactly 9 items.",
    "Each quest item must contain only these properties:",
    "tier, template_key, xp_percent, title_ru, title_en, description_ru, description_en.",
    "Use exactly 3 EASY, 3 MEDIUM and 3 HARD quests.",
    "Each template_key must be unique inside the board.",
    "tier must match the chosen template tier exactly.",
    "Set xp_percent inside these tier ranges:",
    "EASY: 5 to 12.",
    "MEDIUM: 12 to 25.",
    "HARD: 25 to 50.",
    "Keep titles short and game-like.",
    "Descriptions should be one concise sentence.",
    "Russian text must be natural Russian.",
    "English text must be natural English.",
    "Output JSON only."
  ].join("\n");
}

export function buildUserPrompt(payload) {
  const playerClass = payload?.player_class_id ?? payload?.player_class ?? "UNKNOWN";
  const classLevel = payload?.player_class_level ?? payload?.class_level ?? 1;
  const activeQuestCount = payload?.active_quest_count ?? 0;
  const requestedLayout = payload?.requested_layout ?? { easy: 3, medium: 3, hard: 3 };
  const allowedTemplates = Array.isArray(payload?.allowed_templates) ? payload.allowed_templates : [];

  return JSON.stringify(
    {
      instruction: "Generate one quest board for the given player context.",
      required_output_shape: {
        quests: [
          {
            tier: "EASY|MEDIUM|HARD",
            template_key: "one of allowed_templates.template_key",
            xp_percent: 10,
            title_ru: "short Russian title",
            title_en: "short English title",
            description_ru: "short Russian description",
            description_en: "short English description"
          }
        ]
      },
      player_context: {
        player_class: playerClass,
        class_level: classLevel,
        active_quest_count: activeQuestCount
      },
      requested_layout: requestedLayout,
      allowed_templates: allowedTemplates
    },
    null,
    2
  );
}
