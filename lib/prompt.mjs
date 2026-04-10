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
    "tier, template_key, xp_percent, title_ru, title_en, description_ru, description_en, target_count.",
    "Use exactly 3 EASY, 3 MEDIUM and 3 HARD quests.",
    "Each template_key must be unique inside the board.",
    "tier must match the chosen template tier exactly.",
    "Prefer varied template_key choices instead of always using the first templates in each tier.",
    "Strongly prefer resource diversity across COLLECT_ITEM and BREAK_BLOCK quests.",
    "If alternatives exist, avoid repeating the same resource family or target item on the same board.",
    "Use different collectible items and breakable blocks across refreshes whenever allowed_templates make that possible.",
    "Vary target_count in a sensible way for the chosen template so the board feels dynamic, but keep it balanced for the tier.",
    "Set xp_percent inside these tier ranges:",
    "EASY: 5 to 12.",
    "MEDIUM: 12 to 25.",
    "HARD: 25 to 50.",
    "Keep titles short and game-like.",
    "Descriptions should be one concise sentence and mention the real target count. The description must not repeat the title verbatim.",
    'Russian text must be natural Russian. Avoid awkward calques like "майнинг", "горная работа", or noun+noun word order such as "зомби охота". Prefer natural phrases like "Добыча угля" or "Охота на зомби".',
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
      instruction: "Generate one quest board for the given player context. Use a diverse set of allowed_templates, prefer different collectible resources and block targets, and vary target_count sensibly.",
      required_output_shape: {
        quests: [
          {
            tier: "EASY|MEDIUM|HARD",
            template_key: "one of allowed_templates.template_key",
            xp_percent: 10,
            target_count: 8,
            title_ru: "short Russian title",
            title_en: "short English title",
            description_ru: "short Russian description that includes the real target count",
            description_en: "short English description that includes the real target count"
          }
        ]
      },
      player_context: {
        player_class: playerClass,
        class_level: classLevel,
        active_quest_count: activeQuestCount
      },
      board_context: {
        board_key: payload?.board_key ?? "unknown-board",
        player_uuid: payload?.player_uuid ?? "unknown-player"
      },
      requested_layout: requestedLayout,
      allowed_templates: allowedTemplates
    },
    null,
    2
  );
}
