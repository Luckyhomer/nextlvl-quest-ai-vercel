import OpenAI from "openai";
import crypto from "node:crypto";
import { buildSystemPrompt, buildUserPrompt } from "../../lib/prompt.mjs";
import { buildBoardFromAiResult, extractJsonObject, validateBoard } from "../../lib/schema.mjs";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
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

function parsePayload(req) {
  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }
  return req.body ?? {};
}

function parseModelText(completion) {
  const text = completion?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Groq returned an empty response");
  }
  return text;
}

function finalizeBoard(board) {
  const now = Math.floor(Date.now() / 1000);
  return {
    board_id: typeof board.board_id === "string" && board.board_id.trim()
      ? board.board_id.trim()
      : crypto.randomUUID(),
    generated_at: now,
    expires_at: now + 24 * 60 * 60,
    quests: [...board.quests]
      .sort((a, b) => a.slot - b.slot)
      .map((q, index) => ({ ...q, slot: index }))
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

  if (!process.env.GROQ_API_KEY) {
    return sendJson(res, 500, { error: "GROQ_API_KEY is not configured" });
  }

  const payload = parsePayload(req);
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.45,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(payload) }
      ]
    });

    const rawText = parseModelText(completion);
    const rawJson = extractJsonObject(rawText);
    const aiData = JSON.parse(rawJson);
    const board = finalizeBoard(buildBoardFromAiResult(payload, aiData));
    const validationError = validateBoard(board);

    if (validationError) {
      return sendJson(res, 502, {
        error: "AI returned an invalid board",
        details: validationError,
        model,
        raw_preview: rawText.slice(0, 1200)
      });
    }

    return sendJson(res, 200, board);
  } catch (error) {
    return sendJson(res, 500, {
      error: "Quest generation failed",
      details: error?.message || String(error),
      model
    });
  }
}
