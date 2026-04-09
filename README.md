# NextLVL Quest AI Backend for Vercel (Groq v3)

## Что это
Vercel-backend для AI-генерации квестов в `NextLVL Quest`, переведённый на Groq.

## Endpoint
`POST /api/boards/generate`

## Что нужно на Vercel
Environment Variables:
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `NEXTLVL_QUESTS_BACKEND_BEARER`

## Модель по умолчанию
`openai/gpt-oss-20b`

## Особенность v3
Валидация и восстановление доски происходят на стороне backend, поэтому ответ модели может быть частично неточным, но backend всё равно соберёт корректную доску из `allowed_templates`.

## После деплоя
Получишь URL вида:
`https://YOUR-PROJECT.vercel.app/api/boards/generate`
