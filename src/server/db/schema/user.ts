import { relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { auditLogs } from "./audit-log";
import { paymentMethods } from "./payment-method";
import { userRoles } from "./user-role";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    // Nullable a propósito (010 D3): el Customer de Stripe se crea perezosamente
    // en el primer `setup-session`, no en el alta de Clerk. El índice único es
    // NULLS DISTINCT, así que los usuarios sin Customer conviven sin colisionar.
    stripeCustomerId: text("stripe_customer_id"),
    isActive: boolean("is_active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_id_unique").on(t.clerkId),
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_stripe_customer_id_unique").on(t.stripeCustomerId),
    index("users_is_active_idx").on(t.isActive),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles, { relationName: "user_roles_user" }),
  assignedUserRoles: many(userRoles, { relationName: "user_roles_assigned_by" }),
  auditLogs: many(auditLogs),
  paymentMethods: many(paymentMethods),
}));

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
