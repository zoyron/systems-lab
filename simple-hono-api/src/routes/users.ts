import { Hono } from "hono";
import { z } from "zod";

/**
 * The schema and types live close the data they describe.
 * Since they are describing the users, they live in the users route file
 */

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" },
  { id: 4, name: "Sagar", email: "Sagar@example.com" },
];

// create mini hono app just for the users routes
const usersRoute = new Hono();

usersRoute.get("/", (c) => {
  return c.json({ success: true, data: users });
});

// GET /:id route for users
usersRoute.get("/:id", (c) => {
  // getting the id from the request and changing it to number
  const id = Number(c.req.param("id"));
  const user = users.find((u) => u.id === id);

  if (!user) {
    return c.json({ success: false, message: "User not found" }, 404);
  }

  return c.json({ success: true, data: user });
});

export default usersRoute;
