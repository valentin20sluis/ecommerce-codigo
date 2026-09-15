import { z } from "zod";

export const createRoleSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z][a-z0-9_-]*$/, "Usa minúsculas, números, guion y guion bajo."),
  name: z.string().min(2).max(80),
  description: z.string().max(280).nullish(),
});

// `slug` e `isSystem` son inmutables por contrato.
export const updateRoleSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(280).nullish(),
});

export const setRolePermissionsSchema = z.object({
  permissionIds: z.array(z.uuid()).max(500),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
