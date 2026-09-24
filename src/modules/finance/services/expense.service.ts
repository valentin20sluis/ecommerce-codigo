import { api } from "@/lib/axios";
import type {
  CreateExpenseInput,
  CreateRecurringExpenseInput,
  ExpensesQuery,
  UpdateExpenseInput,
  UpdateRecurringExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import type {
  ExpenseDto,
  ExpenseListResponse,
  RecurringExpenseDto,
} from "@/modules/finance/types/expense";

export async function fetchExpenses(query: ExpensesQuery): Promise<ExpenseListResponse> {
  const { data } = await api.get<ExpenseListResponse>("/admin/finance/expenses", { params: query });
  return data;
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseDto> {
  const { data } = await api.post<ExpenseDto>("/admin/finance/expenses", input);
  return data;
}

export async function updateExpense(id: string, input: UpdateExpenseInput): Promise<ExpenseDto> {
  const { data } = await api.patch<ExpenseDto>(`/admin/finance/expenses/${id}`, input);
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/admin/finance/expenses/${id}`);
}

export async function fetchRecurringExpenses(): Promise<RecurringExpenseDto[]> {
  const { data } = await api.get<{ data: RecurringExpenseDto[] }>("/admin/finance/recurring-expenses");
  return data.data;
}

export async function createRecurringExpense(
  input: CreateRecurringExpenseInput,
): Promise<RecurringExpenseDto> {
  const { data } = await api.post<RecurringExpenseDto>("/admin/finance/recurring-expenses", input);
  return data;
}

export async function updateRecurringExpense(
  id: string,
  input: UpdateRecurringExpenseInput,
): Promise<RecurringExpenseDto> {
  const { data } = await api.patch<RecurringExpenseDto>(
    `/admin/finance/recurring-expenses/${id}`,
    input,
  );
  return data;
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  await api.delete(`/admin/finance/recurring-expenses/${id}`);
}
