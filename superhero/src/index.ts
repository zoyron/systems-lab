import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { PrismaClient } from "../generated/prisma/index.js";

// create one prisma client insteance for the whole app
// never create a new prisma client inside each request - it's expensive
const prisma = new PrismaClient();

const app = new Hono();

app.get("/", (c) => {
  return c.text("SuperHero Name Generator API");
});

// This handler is async now because in this request we will be dealing with the database
// that requires disk IO operations. so when nodejs makes the disc calls, using this async await method, sync stuff in the stack will be allowed to run
// and when all the sync work in the stack is done, we'll go back to the event look to execute this handler
app.get("/hero", async (c) => {
  const name = c.req.query("name");
  if (!name) {
    return c.json(
      {
        success: false,
        message: "Please provide a name using ?name=yourname",
      },
      400,
    );
  }

  /**
   * Normalize:lowercase + trim whitespace
   * Sagar, sagar, SAGAR, SAGar, or any combinaiton of this name becomes "sagar"
   */
  const normalizedName = name.trim().toLowerCase();

  // Ask prisma to find a hero with this exact originalName
  const existingHero = await prisma.hero.findUnique({
    where: { originalName: normalizedName },
  });

  // cache hit, this name exists in the db
  if (existingHero) {
    return c.json({ success: true, source: "database", data: existingHero });
  }

  // cache miss - name is new, OpenAi comes in next step

  return c.json({
    success: true,
    source: "not_generated_yet",
    name: normalizedName,
  });
});

serve({ fetch: app.fetch, port: 3000 });

console.log("Server running at http://localhost:3000");
