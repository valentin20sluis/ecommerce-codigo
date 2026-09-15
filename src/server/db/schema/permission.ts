import { relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { rolePermissions } from "./role-permission";

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("permissions_code_unique").on(t.code),
    uniqueIndex("permissions_resource_action_unique").on(t.resource, t.action),
    index("permissions_resource_idx").on(t.resource),
  ],
);

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export type Permission = InferSelectModel<typeof permissions>;
export type NewPermission = InferInsertModel<typeof permissions>;
