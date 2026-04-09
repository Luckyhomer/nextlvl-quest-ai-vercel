import OpenAI from "openai";
import crypto from "node:crypto";
import { questBoardModelSchema, sanitizeBoardFromModel, validateBoard } from "../../lib/schema.mjs";
import { buildSystemPrompt, buildUserPrompt } from "../../lib/prompt.mjs";

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

function readJsonBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }
  return req.body ?? {};
}

function parseModelJson(response) {
  const message = response?.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === "string" && content.trim()) {
    return JSON.parse(content);
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.output_text === "string") return item.output_text;
        return "";
      })
      .join("\n")
      .trim();

    if (text) {
      return JSON.parse(text);
    }
  }

  throw new Error("No JSON content found in Groq response");
}

function finalizeBoard(board) {
  const now = Math.floor(Date.now() / 1000);
  return {
    board_id: crypto.randomUUID(),
    generated_at: now,
    expires_at: now + 24 * 60 * 60,
    quests: [...board.quests].sort((a, b) => a.slot - b.slot)
  };
}

function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1"
  });
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

  const client = createGroqClient();
  if (!client) {
    return sendJson(res, 500, { error: "GROQ_API_KEY is not configured" });
  }

  let payload;
  try {
    payload = readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "Invalid JSON body", details: error?.message || String(error) });
  }

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      n: 1,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: buildUserPrompt(payload)
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nextlvl_quest_board",
          strict: true,
          schema: questBoardModelSchema
        }
      }
    });

    const modelBoard = parseModelJson(response);
    const sanitizedBoard = sanitizeBoardFromModel(modelBoard, payload);
    const board = finalizeBoard(sanitizedBoard);
    const validationError = validateBoard(board, payload);

    if (validationError) {
      return sendJson(res, 502, {
        error: "AI returned an invalid board",
        details: validationError,
        model
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
