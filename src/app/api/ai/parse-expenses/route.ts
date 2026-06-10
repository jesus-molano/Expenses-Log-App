import { NextResponse } from "next/server";
import {
  parseExpenseTextLocally,
  parseExpensesResponseSchema,
} from "@/domain/parser";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

function jsonInstruction(text: string) {
  return `Extract recurring expenses from this Spanish text and return only JSON with this shape: {"expenses":[{"name":"string","description":"string","amount":12.34,"categoryName":"string","tags":["string"],"dueDay":1,"recurrence":{"frequency":"monthly|quarterly|yearly|custom","interval":1,"unit":"day|week|month|year"}}]}. Text: ${text}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Texto invalido para analizar." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      provider: "local",
      expenses: parseExpenseTextLocally(parsedRequest.data.text),
    });
  }

  try {
    const model = process.env.GEMINI_API_MODEL ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: jsonInstruction(parsedRequest.data.text) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) throw new Error(`Gemini failed: ${response.status}`);

    const payload = await response.json();
    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";
    const aiJson = JSON.parse(text);
    const parsed = parseExpensesResponseSchema.safeParse(aiJson);

    if (!parsed.success) throw new Error("Gemini returned invalid shape");

    return NextResponse.json({ provider: "gemini", expenses: parsed.data.expenses });
  } catch {
    return NextResponse.json({
      provider: "local",
      warning: "La IA no respondio con un formato valido. Use parser local.",
      expenses: parseExpenseTextLocally(parsedRequest.data.text),
    });
  }
}
