import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Superhero Name Generator API");
});

app.get("/hero", (c) => {
  // Read the "name" query parameter from the url
  // this is different from route parameter because /users/1 was a separate route entire, but /hero?name=sagar takes you to the hero page only, but just with a different parameter. the route remains the same as the hero, unlike route parameters where /users/1 is a different route from /users/2
  // in this situation /hero?name=sagar is the same route as /hero?name=alice

  const name = c.req.query("name");

  /**
   * If no name was provided, return a 400(Bad request) error
   * 400 means "you sent a bad request - something is missing or wrong"
   */
  if (!name) {
    return c.json({
      success: false,
      message: "Please provide a name using ?name=yourname",
    });
  }

  // for now, just echoing back the name
  return c.json({ success: true, received: name });
});

serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server running at http://localhost:3000");
