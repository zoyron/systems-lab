import { Hono } from "hono";
import { serve } from "@hono/node-server";

// create a Hono instance
const app = new Hono();

//Mock data - a hardcoded list of users
const users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" },
];

// Defining a GET route at the root path "/"
// when someone visits "localhost:3000/", the following code is run
app.get("/", (c) => {
  return c.text("Hello world from Hono server!");
});

// GET /users - a get request at the /users route will return a complete list of the users as json.
app.get("/users", (c) => {
  return c.json(users);
});

// Start the server on port 3000
serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server is running at the https://localhost:3000");
