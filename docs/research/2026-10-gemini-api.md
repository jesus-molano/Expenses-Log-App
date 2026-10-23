# Gemini API: technical brief (2026-10-23)

Diagnosis and plan first, then the evidence.

**Recommendation in short:**
- **Model:** switch from `gemini-2.5-flash` to `gemini-3.5-flash-lite`, with thinking set to minimal.
- **Schema:** enforce a hand-written schema whose categories are an enum of the user's categories.
- **Prompt:** move the rules, today's date and a few examples into `systemInstruction`, and loosen the validation of what comes back.
- **Voice:** add push-to-talk. The app records audio, sends it to the same route, and one Gemini request returns both the transcript and the expenses.
- **API:** stay on REST `generateContent`. Google now calls it "legacy", but it is fully supported and has no announced end date.
- **Compliance:** the project needs billing turned on. Google's terms require paid services for apps used by people in the EU (EEA), Switzerland or the UK.

**How sure each fact is.** I could not open ai.google.dev, firebase.google.com or docs.cloud.google.com from here (the proxy blocked them). The strongest evidence therefore comes from sources I did open:
- **[V]** I read it directly: Google's live REST schema for the API (revision 20261019), the `@google/genai` 2.31.0 package from npm, and Google's own GitHub repos `googleapis/js-genai` and `google-gemini/gemini-skills`.
- **[S]** An official Google page, seen only through search snippets.
- **[3P]** A third-party site.
- **[I]** My own inference.

---

## 0. Why the current Gemini path performs badly (`src/app/api/ai/parse-expenses/route.ts`)
1. **Latency.** Line 105 defaults to `gemini-2.5-flash` and sends no `thinkingConfig`. That model thinks by default [V: js-genai codegen_instructions], which takes several seconds and runs into the 8 s timeout on line 24. Every timeout silently switches to the local parser [I].
2. **No schema.** Lines 118–121 set only `responseMimeType`, with no schema. The Zod check in `src/domain/parser.ts` (lines 5–23) is strict: `dueDay` must be an integer from 1 to 31, `amount` must be positive, and there must be at least one expense. One missing field rejects the whole answer as `invalid_response` and falls back to the local parser.
3. **Thin prompt.** Line 27 gives no current date, so "el mes que viene" or "el viernes" cannot be resolved. It gives no list of the user's categories, so the model invents category names. There is no system instruction, no few-shot examples, and it assumes Spanish only.
4. **API key in the URL.** Line 107 sends `?key=` in the query string, where it ends up in logs. Use the `x-goog-api-key` header instead; the official SDK does this [V].
5. **`temperature: 0.1` stops working on newer models.** The API now silently ignores it "on Gemini 3.6 Flash and newer models" [V: REST schema].
6. **Only the first expense is used.** `src/features/expenses/hooks/use-quick-expense-parser.ts` (line 52) keeps `expenses[0]` and drops any others.
7. **Bug in the local fallback.** The amount regex grabs the first number it sees. "el 5 Netflix 12,99" gives amount 5.
8. **Coarse error handling.** Every 429 becomes "quota_exhausted". There is no single retry, no fallback model, and no check of `finishReason` or `promptFeedback.blockReason`.

## 1. Models (as of 2026-10-23)
- **Google's current list [V: gemini-skills SKILL.md]:** `gemini-3.8-flash` (balanced), `gemini-3.5-flash-lite` (fastest and cheapest 3.5), `gemini-3.1-flash-lite`, `gemini-3.5-transcribe` (speech-to-text) and `gemini-4-argon`. The same file says: "Models like `gemini-2.5-*`, `gemini-2.0-*` … are legacy and deprecated. Never use them." Its migration table says to move `gemini-2.5-flash` to 3.8 Flash or 3.5 Flash-Lite.
- **SDK model list [V: SDK 2.31.0 types]:** includes `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.5/3.6/3.7/3.8-flash`, `gemini-2.5-flash(-lite)`, and the moving aliases `gemini-flash-latest` and `gemini-flash-lite-latest`. Release notes:
  - 3.1 Flash-Lite: 2.1.0, 2026-05-12
  - 3.5 Flash: 2.5.0, 2026-05-20
  - 3.7 Flash: 2026-08-13
  - 3.8 Flash: 2.21.0, 2026-09-02
- **`gemini-3.5-flash-lite`:**
  - GA since 2026-07-21 [S/3P: Cloud docs, Firebase]
  - Accepts text, image, video, audio and PDF; outputs text; 1,048,576 input tokens, 65,536 output tokens [S]
  - Thinks at "minimal" by default [S: thinking docs]
  - Paid price $0.30 per million input tokens (text, image, video and audio alike) and $2.50 per million output tokens including thinking [S: pricing page via search; other sites disagree, so check before relying on it]
- **`gemini-3.8-flash`:**
  - Default thinking level MEDIUM. MINIMAL is rejected with a validation error; LOW, MEDIUM and HIGH are allowed [S: Cloud developer guide]
  - Introductory price $0.75 / $3.75 per million tokens until 2026-12-31, then $1.50 / $7.50 from 2027-01-01 [S: "What's new in 3.8"]
- **`gemini-3.1-flash-lite`:** about $0.25 per million input, $0.50 per million audio input, $1.50 per million output [3P].
- **What happens to 2.5:** on Vertex AI, 2.5 Flash is retired as of 2026-10-20 [3P]. On the Gemini API, 2.5 is "served until further notice" [S/3P], but a shutdown date briefly appeared on the deprecations page and was then removed [3P]. The app should move off 2.5 now.
- **Free tier:** these models have one, but the per-minute and per-day limits are only shown in AI Studio [3P]. On the free tier, content "is used to improve our products"; with billing enabled it is not [S].
- **EEA rule:** "You may use only Paid Services when making API Clients available to users in the EEA, Switzerland, or the UK" [S: Gemini API Additional Terms]. This app's users are in Spain, so billing is required.

## 2. Structured output
- **What to send in `generateContent`:** `responseMimeType: "application/json"` plus either `responseJsonSchema` (JSON Schema) or `responseSchema` (OpenAPI subset), never both [V].
- **Keywords `responseJsonSchema` supports [V]:** `$id`, `$defs`, `$ref`, `$anchor`, `type`, `format`, `title`, `description`, `enum` (strings and numbers), `items`, `prefixItems`, `minItems`, `maxItems`, `minimum`, `maximum`, `anyOf`, `oneOf` (treated as `anyOf`), `properties`, `additionalProperties`, `required`, plus the non-standard `propertyOrdering`.
- **Keywords that are ignored [V: SDK types]:** `minLength`, `maxLength`, `minProperties`, `maxProperties` and `uniqueItems`. `minItems` and `maxItems` are enforced. A schema that is too complex returns 400 INVALID_ARGUMENT.
- **Key order:** the model follows the order of keys in the schema for 2.5 and later [S: Google blog]. `propertyOrdering` is still allowed [V].
- **Deprecation flag to watch [V]:** in REST revision 20261019, `responseSchema` and `response_json_schema` are marked "Deprecated. Use `response_format` instead". The newer field is `generationConfig.responseFormat.text = {mimeType: "APPLICATION_JSON", schema}`. However, SDK 2.31.0 still exposes `responseJsonSchema` and not `responseFormat` for `generateContent`. Both work today; keep `responseJsonSchema` and plan to switch later [I].
- **Optional fields (nullable):** the blog lists `anyOf` and `type: 'null'` as supported [S]. The `["string","null"]` array form is not confirmed, and one forum thread reports a 400 for a nullable `anyOf` on 3.8 Flash through the newer Interactions API [3P]. Use `anyOf` with `{type: "null"}` and test it against the chosen model.
- **Generating the schema from Zod:** Zod v4's `z.toJSONSchema` output can contain keywords outside the supported list, such as `exclusiveMinimum` from `.positive()`, `$schema` and `pattern` [3P/I]. Hand-write the small Gemini schema, or strip those keywords from the generated one. Keep Zod for checking the answer on the server.

## 3. Thinking
- **Gemini 3.x uses `thinkingConfig.thinkingLevel`** with values MINIMAL, LOW, MEDIUM or HIGH. The REST schema says it is "Recommended for Gemini 3 or later. Use with earlier models results in an error" [V].
- **Gemini 2.5 uses `thinkingBudget`.** 0 turns thinking off and lowers latency; it can't be turned off on 2.5 Pro (minimum 128) [V: js-genai codegen instructions]. In the SDK, 0 means off and -1 means automatic [V].
- **Settings for this app:** 3.5 Flash-Lite with MINIMAL, or 3.8 Flash with LOW. Remove `temperature`, `top_p` and `top_k`; Google's migration checklist says to do this for 3.8 Flash and 3.5 Flash-Lite [V].
- **Latency:** Artificial Analysis measured about 6–8 s to the first token for 3.5 Flash-Lite, but on 10,000-token inputs with default settings [3P]. For this app's prompts of under ~1,500 tokens at minimal thinking, I expect roughly 1–2 s for text [I]. Measure it, and keep the timeout at 8–10 s.

## 4. Prompt design
- `systemInstruction` accepts text only [V].
- Put these in it:
  - today's date, weekday and time zone (Europe/Madrid)
  - currency EUR and the user's language
  - the user's categories, also given as an enum in the schema
  - mapping rules: mensual → monthly, trimestral → quarterly, anual → yearly plus `annualMonth`, "cada N meses" → custom, puntual → once plus `startDate`
  - number parsing ("12,99" is 12.99)
  - "if a value is unknown, use null; never invent amounts"
  - 3–5 short example pairs in the exact output schema [I: standard few-shot practice]
- Validate leniently on the server. Accept partial drafts, fill in defaults, mark fields that need review, and offer every extracted expense, not only the first.

## 5. Authentication and SDK
- The `x-goog-api-key` header is what `@google/genai` sends [V: SDK code]. `?key=` also works [V: REST schema] but leaks into logs.
- **`@google/genai`:**
  - Latest is 2.31.0, published 2026-10-23; needs Node 20 or later; version 3.0.0 will need Node 22 [V]
  - Dependencies: google-auth-library, p-retry, protobufjs, ws; the built package is about 12 MB [V]
  - Has separate browser and Node builds [V]
  - Older packages `@google/generative-ai` and `@google-ai/generativelanguage` are deprecated [V]
  - Edge runtime: not verified. Keep the route on the Node runtime [I].
- **Recommendation:** keep plain `fetch` (no new dependency, and the tests already mock `fetch`).
- **Interactions API:** it has been Google's default interface since June 2026 [S]. It does not support Batch or explicit caching [S]. It stores requests by default (55 days on paid, 1 day on free), so `store: false` is required for financial data [V]. `generateContent` also accepts a `store` field [V]. Migrating to it is optional, not needed for this fix.

## 6. Audio input
- **Formats:** WAV, MP3, AIFF, AAC, OGG, FLAC, MPEG, M4A, L16, Opus, ALAW, MULAW and WebM [S: audio docs]. SDK 2.20.0 (2026-08-31) added `audio/webm` [V]. The REST schema accepts "Audio: audio/*" [V].
- **Safari's `audio/mp4`:** not in the official list. Test sending it as `audio/mp4` and as `audio/m4a` [I].
- **Size limit:** inline data can be up to 100 MB (base64) since 2026-01-12; it used to be 20 MB [S: Google blog]. The real limit here is the host: Vercel Functions take about 4.5 MB of request body [I: verify]. Cap recordings at 30–60 s. Opus at ~32 kbps is about 120 KB per 30 s.
- **Cost per second:** 32 tokens per second [S: audio docs], or 25 per second for Gemini 3 [S: media-resolution page and Cloud pricing]. 30 s is about 750–960 tokens, which is a fraction of a cent. Audio is downsampled to 16 kbps mono [S].
- **One request does both jobs:** audio in and JSON out works in a single call [I: multimodal input plus structured output are independent features]. Put `transcript` first in the schema so the user sees what was heard.
- **Optional transcription settings:** `generationConfig.audioTranscriptionConfig` exists, with `languageCodes`, `customVocabulary` (useful for brand names like Netflix or Mercadona) and `mode` VERBATIM or SMART [V: REST schema; SDK 2.14.0, 2026-07-28]. It is unclear which models honour it, so treat it as an experiment.
- **`gemini-3.5-transcribe`:** a separate speech-to-text model at about $2 per million input / $12 per million output, with conflicting reports on whether it is preview or GA [3P]. It would add a second call; not needed.
- **Live API** (`gemini-3.8-live`, `gemini-3.5-transcribe-live`; needs WebSocket plus short-lived tokens [V: skill]): overkill for push-to-talk.
- **Browser recording:** use `MediaRecorder` with `audio/webm;codecs=opus` first and `audio/mp4` as the fallback, checked with `isTypeSupported` [3P: Safari 18.4+ records WebM]. Strip the `;codecs=` part before sending [I].
- **Browser speech recognition (Web Speech API):** historically it does not work in installed iOS home-screen apps [3P, 2021; a newer undated page agrees]. At most a progressive enhancement, not the main path.

## 7. Errors and retries
| Status | Meaning | What to do |
|---|---|---|
| 400 INVALID_ARGUMENT | Bad parameter or schema (e.g. `thinkingLevel` on 2.5, MINIMAL on 3.8 Flash, too-complex schema) | Don't retry; use the local parser |
| 403 | Key or project problem | Don't retry; flag the configuration |
| 404 | Model id retired | Switch to the fallback model and alert |
| 429 RESOURCE_EXHAUSTED | Rate or quota limit, per project and per model; daily limit resets at midnight Pacific [3P] | Retry once only if the server's suggested `retryDelay` is ≤ ~2 s; otherwise try the fallback model, which likely has its own quota [I]; then local |
| 500 / 503 UNAVAILABLE | Temporary capacity problem [S] | One retry with random jitter inside the 8–10 s budget, then the fallback model |
| 504 DEADLINE_EXCEEDED | Took too long [S] | Same as 503 |

- The SDK's default retries are 5 attempts, starting at 1 s, doubling, up to 60 s, on codes 408, 429 and 5xx [V]. That is too aggressive for a screen the user is waiting on; if the SDK is used, set `attempts: 2`.
- Also check `candidates[0].finishReason` (STOP versus MAX_TOKENS, SAFETY, MALFORMED…) and `promptFeedback.blockReason`. Ignore parts with `thought: true`.

## 8. Request examples (REST v1beta)
**A. Text** — `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, headers `x-goog-api-key: $GEMINI_API_KEY` and `Content-Type: application/json`:
```json
{
  "systemInstruction": {"parts": [{"text": "Extraes gastos recurrentes. Hoy es 2026-10-23 (viernes), zona Europe/Madrid, moneda EUR. Categorías permitidas: Casa, Suscripciones, Vehiculo, General. 'mensual'→monthly; 'trimestral'→quarterly; 'anual'→yearly (+annualMonth); 'cada N meses'→custom; 'puntual/una vez'→once (+startDate). '12,99' = 12.99. Si un dato no aparece usa null; nunca inventes importes.\nEjemplo: 'Netflix 12,99 el 5' → {\"transcript\":\"Netflix 12,99 el 5\",\"expenses\":[{\"name\":\"Netflix\",\"amount\":12.99,\"categoryName\":\"Suscripciones\",\"frequency\":\"monthly\",\"interval\":null,\"unit\":null,\"dueDay\":5,\"annualMonth\":null,\"startDate\":null}]}"}]},
  "contents": [{"role": "user", "parts": [{"text": "Seguro del coche 420 al año en marzo y gimnasio 35 al mes el día 1"}]}],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseJsonSchema": {
      "type": "object",
      "properties": {
        "transcript": {"type": "string"},
        "expenses": {"type": "array", "maxItems": 10, "items": {"type": "object",
          "properties": {
            "name": {"type": "string"},
            "amount": {"anyOf": [{"type": "number", "minimum": 0}, {"type": "null"}]},
            "categoryName": {"type": "string", "enum": ["Casa", "Suscripciones", "Vehiculo", "General"]},
            "frequency": {"type": "string", "enum": ["once", "monthly", "quarterly", "yearly", "custom"]},
            "interval": {"anyOf": [{"type": "integer", "minimum": 1}, {"type": "null"}]},
            "unit": {"anyOf": [{"type": "string", "enum": ["day", "week", "month", "year"]}, {"type": "null"}]},
            "dueDay": {"anyOf": [{"type": "integer", "minimum": 1, "maximum": 31}, {"type": "null"}]},
            "annualMonth": {"anyOf": [{"type": "integer", "minimum": 1, "maximum": 12}, {"type": "null"}]},
            "startDate": {"anyOf": [{"type": "string", "format": "date"}, {"type": "null"}]}
          },
          "required": ["name", "amount", "categoryName", "frequency", "interval", "unit", "dueDay", "annualMonth", "startDate"]}}
      },
      "required": ["transcript", "expenses"]
    },
    "thinkingConfig": {"thinkingLevel": "MINIMAL"},
    "maxOutputTokens": 1024
  }
}
```
Read the reply from `candidates[0].content.parts[].text`, skipping parts with `thought: true`, then `JSON.parse` it and check it with Zod.

**B. Voice** — the same request, with these `contents`:
```json
"contents": [{"role": "user", "parts": [
  {"inlineData": {"mimeType": "audio/webm", "data": "<base64>"}},
  {"text": "Transcribe el audio en 'transcript' y extrae los gastos."}
]}]
```

**C. Fallback on 2.5 Flash** — replace the thinking setting with `"thinkingConfig": {"thinkingBudget": 0}`. Do not send `thinkingLevel` to 2.5; it returns an error.

**D. Interactions API (optional, later)** — `POST https://generativelanguage.googleapis.com/v1beta/interactions`, with `x-goog-api-key` and `Api-Revision: 2026-05-20`. Google's checklist lists that header; one newer doc example leaves it out [S]:
```json
{"model": "gemini-3.5-flash-lite", "system_instruction": "…", "store": false,
 "input": [{"type": "text", "text": "…"}, {"type": "audio", "mime_type": "audio/webm", "data": "<base64>"}],
 "response_format": {"type": "text", "mime_type": "application/json", "schema": {"…": "same schema"}},
 "generation_config": {"thinking_level": "minimal", "max_output_tokens": 1024}}
```
The reply text is `interaction.output_text`, or the last `model_output` step's `content[0].text`.

## 9. Recommendation for this app
1. **Model setting:** `GEMINI_API_MODEL=gemini-3.5-flash-lite` with MINIMAL thinking. Fallback `gemini-3.1-flash-lite`. Use `gemini-3.8-flash` with LOW only if quality falls short. Don't use the `-latest` aliases in production. Update `.env.example`, `README.md` and `docs/platform.md`.
2. **Route changes:** header authentication, `systemInstruction` built per request (date, language, the user's categories, examples), a hand-written `responseJsonSchema`, no `temperature`, a `maxOutputTokens` cap, a 10 s timeout for audio, and lenient mapping into `DraftExpense` with `null` meaning "needs review". Return every expense plus the transcript.
3. **Voice route:** accept the upload as `multipart/form-data` of at most ~1 MB or 60 s, reuse the same pipeline, and push-to-talk in the UI via a hook such as `features/expenses/hooks/use-voice-capture.ts`. Encode to base64 on the server.
4. **Errors:** the policy in §7, plus a `reason` value for 404/model-unavailable.
5. **Ops and compliance:** billing on, because users are in the EEA and Spain. Send `store: false` if logging gets enabled. Rough cost is about $0.0005–0.001 per parse [I].
6. **Tests (Vitest):** schema mapping from nulls to draft, error-code mapping, MIME type normalisation, and building the prompt with the date and categories.

## Sources
- Gemini REST schema, live (revision 20261019): https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta
- npm @google/genai (2.31.0, 2026-10-23): https://registry.npmjs.org/@google/genai — types in the package's `dist/genai.d.ts`
- js-genai: https://raw.githubusercontent.com/googleapis/js-genai/main/CHANGELOG.md · https://raw.githubusercontent.com/googleapis/js-genai/main/README.md · https://raw.githubusercontent.com/googleapis/js-genai/refs/heads/main/codegen_instructions.md
- Google gemini-skills: https://raw.githubusercontent.com/google-gemini/gemini-skills/main/skills/gemini-api-dev/SKILL.md · https://raw.githubusercontent.com/google-gemini/gemini-skills/main/skills/gemini-api-dev/references/migration.md
- Official pages seen via search: https://ai.google.dev/gemini-api/docs/models · https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite · https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.8 · https://ai.google.dev/gemini-api/docs/thinking · https://ai.google.dev/gemini-api/docs/pricing · https://ai.google.dev/gemini-api/docs/audio · https://ai.google.dev/gemini-api/docs/transcribe · https://ai.google.dev/gemini-api/docs/generate-content/structured-output · https://ai.google.dev/gemini-api/docs/interactions/structured-output · https://ai.google.dev/gemini-api/docs/generate-content/api-errors · https://ai.google.dev/gemini-api/docs/media-resolution · https://ai.google.dev/gemini-api/terms-archive/terms_11_20_25 · https://ai.google.dev/gemini-api/docs/logs-policy.md · https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-new-file-limits/ · https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/ · https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/ · https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash · https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite · https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/audio-understanding · https://firebase.google.com/docs/ai-logic/models
- Third-party: https://www.developersdigest.tech/blog/vertex-ai-shutdowns-october-2026 · https://artificialanalysis.ai/models/gemini-3-5-flash-lite/providers · https://discuss.ai.google.dev/t/gemini-3-8-flash-interactions-v1beta-http-400-invalid-request-with-stateless-structured-output/184654 · https://firt.dev/notes/pwa-ios/ · https://whatpwacando.today/speech-recognition
