# NextLVL Quest AI Backend for Vercel (Gemini version)

## Что это
Vercel-версия backend для AI-генерации квестов в `NextLVL Quest`, переведённая на Gemini через OpenAI-compatible endpoint.

## Endpoint
`POST /api/boards/generate`

## Что нужно на Vercel
Environment Variables:
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `NEXTLVL_QUESTS_BACKEND_BEARER`

## Значения по умолчанию
- `GEMINI_MODEL=gemini-2.5-flash`

## После деплоя
Получишь URL вида:
`https://YOUR-PROJECT.vercel.app/api/boards/generate`
