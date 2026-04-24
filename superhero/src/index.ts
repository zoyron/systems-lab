import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { prisma } from "./lib/prisma.js";
import { generateHero } from "./lib/openai.js";

const app = new Hono();

app.get("/", (c) => {
  return c.text("SuperHero Name Generator API — try GET /hero?name=yourname");
});

app.get("/hero", async (c) => {
  const name = c.req.query("name");

  if (!name) {
    return c.json(
      { success: false, message: "Please provide a name using ?name=yourname" },
      400,
    );
  }

  const normalizedName = name.trim().toLowerCase();

  // Check database first — free and instant
  const existingHero = await prisma.hero.findUnique({
    where: { originalName: normalizedName },
  });

  if (existingHero) {
    return c.json({ success: true, source: "database", data: existingHero });
  }

  // Not in DB — call OpenAI and persist the result
  try {
    const generated = await generateHero(normalizedName);

    const hero = await prisma.hero.create({
      data: {
        originalName: normalizedName,
        superheroName: generated.superheroName,
        description: generated.description,
        nameMeaning: generated.nameMeaning,
      },
    });

    return c.json({ success: true, source: "generated", data: hero });
  } catch (err) {
    console.error("Generation failed:", err);
    return c.json({ success: false, message: "Failed to generate hero" }, 500);
  }
});

// Return all heroes stored in the database
app.get("/heroes", async (c) => {
  const heroes = await prisma.hero.findMany({
    orderBy: { createdAt: "desc" },
  });
  return c.json({ success: true, data: heroes });
});

serve({ fetch: app.fetch, port: 3000 });

console.log("Server running at http://localhost:3000");
