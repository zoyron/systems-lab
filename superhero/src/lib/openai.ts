import OpenAI from "openai";
import { z } from "zod";

// OpenRouter is OpenAI-SDK compatible — just change the baseURL and key
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const HeroResponseSchema = z.object({
  superheroName: z.string(),
  description: z.string(),
  nameMeaning: z.string(),
});

export type HeroResponse = z.infer<typeof HeroResponseSchema>;

export async function generateHero(
  originalName: string,
): Promise<HeroResponse> {
  const completion = await client.chat.completions.create({
    model: "google/gemma-3-12b-it:free",
    messages: [
      {
        role: "system",
        content: `You are a creative superhero name generator. Given a person's name, invent a superhero identity and explain the name's meaning.
Always respond with ONLY valid JSON in this exact format, no extra text:
{
  "superheroName": "...",
  "description": "...",
  "nameMeaning": "..."
}`,
      },
      {
        role: "user",
        content: `Generate a superhero persona for someone named "${originalName}".`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("No response from model");

  // Strip markdown code fences if the model wraps the JSON in ```json ... ```
  const cleaned = content
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  // Parse and validate with Zod — throws if the model returned bad JSON
  const parsed = HeroResponseSchema.parse(JSON.parse(cleaned));
  return parsed;
}
