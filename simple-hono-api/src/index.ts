import { Hono } from "hono";
import { serve } from "@hono/node-server";
import usersRoute from "./routes/users.js";
import productsRoute from "./routes/products.js";

// create a Hono instance
const app = new Hono();

// Defining a GET route at the root path "/"
// when someone visits "localhost:3000/", the following code is run
app.get("/", (c) => {
  return c.text("Hello world from Hono server!");
});

// usersRoute mounting
app.route("/users", usersRoute);

// productsRoute mounting
app.route("/products", productsRoute);

// Start the server on port 3000
serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server is running at the https://localhost:3000");
