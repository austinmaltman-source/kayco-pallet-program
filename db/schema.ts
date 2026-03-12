import { jsonb, pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  pallet: jsonb("pallet").notNull(),
  products: jsonb("products").notNull().default("[]"),
  placements: jsonb("placements").notNull().default("[]"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
