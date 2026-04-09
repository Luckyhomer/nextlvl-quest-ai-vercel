import OpenAI from "openai";
import crypto from "node:crypto";
import {
  aiQuestSelectionSchema,
  validateBoard,
  validateSelection
} from "../../lib/schema.mjs";
import { buildSystemPrompt, buildUserPrompt } from "../../lib/prompt.mjs";

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBearer(req) {
  const auth = req.headers["authorization"] || req.headers["Authorization"];
  if (!auth || typeof auth !== "string") return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}

function normalizeMessageContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function parseCompletionJson(completion) {
  const content = normalizeMessageContent(completion?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("No JSON text found in Gemini response");
  }
  return JSON.parse(content);
}

function starsForTier(tier) {
  if (tier === "EASY") return 1;
  if (tier === "MEDIUM") return 2;
  return 3;
}

function clampXp(tier, value) {
  const numeric = Number(value);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : NaN;

  if (tier === "EASY") return Math.min(12, Math.max(5, Number.isFinite(rounded) ? rounded : 8));
  if (tier === "MEDIUM") return Math.min(25, Math.max(12, Number.isFinite(rounded) ? rounded : 18));
  return Math.min(50, Math.max(25, Number.isFinite(rounded) ? rounded : 35));
}

function normalizeText(value, fallback) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function buildBoardFromSelection(payload, selection) {
  const templates = Array.isArray(payload?.allowed_templates) ? payload.allowed_templates : [];
  const templateMap = new Map();
  for (const template of templates) {
    if (template?.template_key) templateMap.set(template.template_key, template);
  }

  const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const usedTemplateKeys = new Set();
  const quests = [];

  for (const picked of selection.quests ?? []) {
    const template = templateMap.get(picked.template_key);
    if (!template) {
      throw new Error(`Unknown template_key returned by Gemini: ${picked.template_key}`);
    }

    if (usedTemplateKeys.has(picked.template_key)) {
      throw new Error(`Duplicate template_key returned by Gemini: ${picked.template_key}`);
    }
    usedTemplateKeys.add(picked.template_key);

    if (template.tier !== picked.tier) {
      throw new Error(`Tier mismatch for template ${picked.template_key}: got ${picked.tier}, expected ${template.tier}`);
    }

    counts[picked.tier] = (counts[picked.tier] ?? 0) + 1;

    quests.push({
      tier: picked.tier,
      stars: starsForTier(picked.tier),
      template_key: template.template_key,
      quest_type: template.type,
      title_ru: normalizeText(picked.title_ru, template.objective_ru),
      title_en: normalizeText(picked.title_en, template.objective_en),
      description_ru: normalizeText(picked.description_ru, template.objective_ru),
      description_en: normalizeText(picked.description_en, template.objective_en),
      target_id: template.target_key,
      target_count: Number(template.target_count),
      xp_percent: clampXp(picked.tier, picked.xp_percent)
    });
  }

  if (counts.EASY !== 3 || counts.MEDIUM !== 3 || counts.HARD !== 3) {
    throw new Error(`Gemini must return exactly 3 EASY, 3 MEDIUM, 3 HARD quests, got ${counts.EASY}/${counts.MEDIUM}/${counts.HARD}`);
  }

  const tierOrder = { EASY: 0, MEDIUM: 1, HARD: 2 };
  const orderedQuests = quests
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])
    .map((quest, slot) => ({ ...quest, slot }));

  const now = Math.floor(Date.now() / 1000);
  return {
    board_id: crypto.randomUUID(),
    generated_at: now,
    expires_at: now + 24 * 60 * 60,
    quests: orderedQuests
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const expectedBearer = process.env.NEXTLVL_QUESTS_BACKEND_BEARER;
  if (expectedBearer) {
    const actualBearer = readBearer(req);
    if (actualBearer !== expectedBearer) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    return sendJson(res, 500, { error: "GEMINI_API_KEY is not configured" });
  }

  const payload = parseRequestBody(req);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(payload) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nextlvl_quest_board_selection",
          strict: true,
          schema: aiQuestSelectionSchema
        }
      }
    });

    const selection = parseCompletionJson(completion);
    const selectionError = validateSelection(selection, payload?.allowed_templates);
    if (selectionError) {
      return sendJson(res, 502, { error: "Gemini returned an invalid selection", details: selectionError });
    }

    const board = buildBoardFromSelection(payload, selection);
    const boardError = validateBoard(board);
    if (boardError) {
      return sendJson(res, 502, { error: "Generated board is invalid", details: boardError });
    }

    return sendJson(res, 200, board);
  } catch (error) {
    return sendJson(res, 500, { error: "Quest generation failed", details: error?.message || String(error) });
  }
}
