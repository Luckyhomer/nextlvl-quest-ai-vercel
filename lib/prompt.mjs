export function buildSystemPrompt() {
  return [
    "You write localized text for Minecraft RPG quest cards for the NextLVL Quest mod.",
    "Return only a single valid JSON object and no markdown.",
    "Do not wrap the JSON in triple backticks.",
    "The selected_templates array already contains the exact quest templates chosen by the backend.",
    "Never invent template_key values and never omit any selected template.",
    "The JSON object must have exactly one property: quests.",
    "quests must be an array with exactly the same number of items as selected_templates.",
    "Each quest item must contain only these properties:",
    "template_key, xp_percent, target_count, title_ru, title_en, description_ru, description_en.",
    "Keep template_key exactly equal to the selected template key.",
    "Use the selected template objective and target resource as the semantic basis of the text.",
    "Russian text must be natural Russian. Avoid awkward calques like 'майнинг', 'горная работа', 'зомби охота', or title/description duplication.",
    "English text must be natural English.",
    "Titles must be short and game-like.",
    "Descriptions must be one concise sentence, mention the real target count, and must not repeat the title verbatim.",
    "Output JSON only."
  ].join("\n");
}

export function buildUserPrompt(payload, selectedTemplates) {
  const playerClass = payload?.player_class_id ?? payload?.player_class ?? "UNKNOWN";
  const classLevel = payload?.player_class_level ?? payload?.class_level ?? 1;
  const activeQuestCount = payload?.active_quest_count ?? 0;
  const requestedLayout = payload?.requested_layout ?? { easy: 3, medium: 3, hard: 3 };

  return JSON.stringify(
    {
      instruction: "Write localized quest card text for the selected templates. Keep template_key exactly unchanged and return one quest object per selected template.",
      required_output_shape: {
        quests: [
          {
            template_key: "one of selected_templates.template_key",
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
      selected_templates: selectedTemplates
    },
    null,
    2
  );
}
