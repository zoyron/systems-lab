import { z } from "zod";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

// Define the schema - the blueprint for what a User object must look like
const UserSchema = z.object({
  id: z.number(), // id must be a number
  name: z.string(), // name must be a string
  email: z.string().email(), //email must be a string AND must look like a valid email
});

/**
 * Ask Zod to infer the typescript type from the schema
 * Now "User" is a real typepscript type - no need to write it(the type) manually
 */
type User = z.infer<typeof UserSchema>;

// create a Hono instance
const app = new Hono();

//Mock data - a hardcoded list of users
// Annotating the user array with the User type
const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" },
  { id: 4, name: "Sagar", email: "Sagar@example.com" },
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

// Making a new route of GET /user/:id - this returns a single user matching the given id
app.get("/users/:id", (c) => {
  const id = Number(c.req.param("id"));
  const user = users.find((u) => u.id === id); // here in the users array, we are finding an element where the id matches the we passed through the client

  // the find function either returns the id number or returns undefined
  // if the user was not found, we send the error mesasge along with 404
  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  // if the user was found, we send the user object as JSON along with 200 code
  return c.json(user);
});

// Start the server on port 3000
serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server is running at the https://localhost:3000");
