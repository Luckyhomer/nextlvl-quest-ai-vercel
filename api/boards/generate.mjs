import OpenAI from "openai";
import crypto from "node:crypto";
import { questBoardSchema, validateBoard } from "../../lib/schema.mjs";
import { buildSystemPrompt, buildUserPrompt } from "../../lib/prompt.mjs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function parseResponseJson(response) {
  if (response?.output_text) return JSON.parse(response.output_text);

  const chunks = [];
  for (const out of response?.output ?? []) {
    for (const item of out?.content ?? []) {
      if (typeof item?.text === "string") chunks.push(item.text);
      if (typeof item?.output_text === "string") chunks.push(item.output_text);
    }
  }
  if (!chunks.length) throw new Error("No JSON text found in OpenAI response");
  return JSON.parse(chunks.join("\n"));
}

function finalizeBoard(board) {
  const now = Math.floor(Date.now() / 1000);
  return {
    ...board,
    board_id: board.board_id || crypto.randomUUID(),
    generated_at: now,
    expires_at: now + 24 * 60 * 60,
    quests: [...board.quests].sort((a, b) => a.slot - b.slot).map((q, index) => ({ ...q, slot: index }))
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

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "OPENAI_API_KEY is not configured" });
  }

  const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt() }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt(payload) }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "nextlvl_quest_board",
          schema: questBoardSchema,
          strict: true
        }
      }
    });

    const board = finalizeBoard(parseResponseJson(response));
    const validationError = validateBoard(board);

    if (validationError) {
      return sendJson(res, 502, { error: "AI returned an invalid board", details: validationError });
    }

    return sendJson(res, 200, board);
  } catch (error) {
    return sendJson(res, 500, { error: "Quest generation failed", details: error?.message || String(error) });
  }
}
