import { z } from "zod";

export const setUserRolesSchema = z.object({
  roleIds: z.array(z.uuid()).max(20),
});

export const usersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
