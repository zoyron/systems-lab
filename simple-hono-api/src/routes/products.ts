import { Hono } from "hono";
import { z } from "zod";

// Products have a different shape from users - name, price, category

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  category: z.string(),
});

type Product = z.infer<typeof ProductSchema>;

const products: Product[] = [
  { id: 1, name: "Mechanical Keyboard", price: 149, category: "Electronics" },
  { id: 2, name: "Desk Lamp", price: 39, category: "Furniture" },
  { id: 3, name: "Notebook", price: 12, category: "Stationery" },
];

const productsRoute = new Hono();

// home route
productsRoute.get("/", (c) => {
  return c.text("This is the products page");
});

// GET /all route - returns a list of all the products
productsRoute.get("/all", (c) => {
  return c.json({ success: true, data: products });
});

// GET /:id - returns a single product by id
productsRoute.get("/:id", (c) => {
  const id = Number(c.req.param("id"));
  const product = products.find((p) => p.id === id);
  if (!product) {
    return c.json({ success: false, message: "Product not found" }, 404);
  }

  return c.json({ success: true, data: product });
});

export default productsRoute;
