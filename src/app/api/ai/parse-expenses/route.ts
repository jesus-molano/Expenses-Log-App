import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { z } from "zod";
import {
  buildCaptureResponseSchema,
  buildCaptureSystemInstruction,
  parseCaptureResponse,
} from "@/data/ai/expense-capture-prompt";
import {
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODEL,
  generateJson,
  type GeminiFailureReason,
} from "@/data/ai/gemini-client";
import { normalizeCaptureCommand, type CaptureCommand } from "@/domain/capture-commands";
import { PRESET_EXPENSE_CATEGORIES } from "@/domain/categories";
import {
  CAPTURE_TEXT_MAX_LENGTH,
  normalizeCapturedExpense,
  type CapturedDraft,
} from "@/domain/expense-capture";
import { parseCaptureTextLocally } from "@/domain/parser";
import { createClient } from "@/utils/supabase/server";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(CAPTURE_TEXT_MAX_LENGTH),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  language: z.enum(["es", "en"]).optional(),
  // Categorías raras (muy largas o demasiadas) se descartan sin rechazar el
  // texto: solo sirven de pista al modelo.
  categories: z
    .array(z.string())
    .max(500)
    .optional()
    .transform((names) =>
      (names ?? [])
        .map((name) => name.trim())
        .filter((name) => name.length > 0 && name.length <= 40)
        .slice(0, 40),
    ),
  // Nombres de los gastos del usuario, para entender órdenes sobre ellos
  // ("marca la luz pagada"). Como las categorías, solo son una pista.
  expenseNames: z
    .array(z.string())
    .max(500)
    .optional()
    .transform((names) =>
      Array.from(
        new Set(
          (names ?? [])
            .map((name) => name.trim())
            .filter((name) => name.length > 0 && name.length <= 60),
        ),
      ).slice(0, 50),
    ),
});

export type CaptureFallbackReason =
  | "missing_key"
  | "rate_limited"
  | "unauthenticated"
  | GeminiFailureReason;

const requestBuckets = new Map<string, number[]>();
// Guarda contra ráfagas, por instancia; la cuota real la pone Google.
const GEMINI_REQUESTS_PER_MINUTE = 20;

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestBuckets.get(key) ?? []).filter(
    (timestamp) => timestamp > now - 60_000,
  );
  if (recent.length >= GEMINI_REQUESTS_PER_MINUTE) {
    requestBuckets.set(key, recent);
    return true;
  }
  requestBuckets.set(key, [...recent, now]);
  return false;
}

// La fecha la manda el cliente (su zona horaria), pero solo se acepta a dos
// días de la del servidor.
function resolveToday(clientToday: string | undefined, now = new Date()) {
  const min = format(addDays(now, -2), "yyyy-MM-dd");
  const max = format(addDays(now, 2), "yyyy-MM-dd");
  if (clientToday && clientToday >= min && clientToday <= max) return clientToday;
  return format(now, "yyyy-MM-dd");
}

function respond(
  provider: "gemini" | "local",
  drafts: CapturedDraft[],
  commands: CaptureCommand[],
  extra = {},
) {
  return NextResponse.json({
    provider,
    ...extra,
    // `expenses` sigue siendo la lista de borradores para clientes anteriores.
    expenses: drafts.map((item) => item.draft),
    review: drafts.map(({ missingFields, inferredFields }) => ({
      missingFields,
      inferredFields,
    })),
    // Órdenes sobre gastos existentes; un cliente anterior las ignora.
    commands,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Texto inválido para analizar." },
      { status: 400 },
    );
  }

  const { text, language = "es" } = parsedRequest.data;
  const today = resolveToday(parsedRequest.data.today);
  const categories = Array.from(
    new Set([
      ...PRESET_EXPENSE_CATEGORIES.map((category) => category.name),
      ...parsedRequest.data.categories,
    ]),
  );
  const local = (reason: CaptureFallbackReason) => {
    const parsed = parseCaptureTextLocally(text, { today, categories });
    return respond("local", parsed.drafts, parsed.commands, { reason });
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return local("missing_key");

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };
  if (userError || !user) return local("unauthenticated");
  if (isRateLimited(`user:${user.id}`)) return local("rate_limited");

  const result = await generateJson({
    apiKey,
    models: [
      process.env.GEMINI_API_MODEL || GEMINI_DEFAULT_MODEL,
      process.env.GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL,
    ],
    systemInstruction: buildCaptureSystemInstruction({
      today,
      language,
      categories,
      expenseNames: parsedRequest.data.expenseNames,
    }),
    userText: text,
    schema: buildCaptureResponseSchema(categories),
  });
  if (!result.ok) return local(result.reason);

  const parsed = parseCaptureResponse(result.json);
  if (!parsed) return local("invalid_response");

  const creates = parsed.items.filter((item) => !item.intent || item.intent === "create");
  const commands = parsed.items.flatMap((item) => {
    const command = normalizeCaptureCommand(item);
    return command ? [command] : [];
  });
  return respond(
    "gemini",
    creates.map((item) => normalizeCapturedExpense(item, { today, categories })),
    commands,
    { droppedCount: parsed.droppedCount },
  );
}
