export type ReviewIssueType =
  | "needs_review"
  | "possible_duplicate"
  | "unpaid"
  | "partially_paid"
  | "amount_mismatch"
  | "missing_proof"
  | "low_ai_confidence";

export interface ReviewIssue {
  type: ReviewIssueType;
  label: string;
  tone: "amber" | "orange" | "red" | "blue" | "violet";
}

export interface ReviewExpenseLike {
  id: string;
  expense_date: string;
  vendor: string;
  amount: number | string;
  status?: string | null;
  expense_type?: string | null;
  document_type?: string | null;
  payment_status?: string | null;
  receipt_file_path?: string | null;
  invoice_number?: string | null;
  ai_confidence?: number | null;
  paid_amount?: number | string | null;
  payment_reference?: string | null;
  payment_proof_file_path?: string | null;
}

export const REVIEW_ISSUES: Record<ReviewIssueType, ReviewIssue> = {
  needs_review: { type: "needs_review", label: "Needs Review", tone: "amber" },
  possible_duplicate: { type: "possible_duplicate", label: "Possible Duplicate", tone: "violet" },
  unpaid: { type: "unpaid", label: "Unpaid", tone: "orange" },
  partially_paid: { type: "partially_paid", label: "Partially Paid", tone: "amber" },
  amount_mismatch: { type: "amount_mismatch", label: "Amount Mismatch", tone: "red" },
  missing_proof: { type: "missing_proof", label: "Missing Proof", tone: "blue" },
  low_ai_confidence: { type: "low_ai_confidence", label: "Low AI Confidence", tone: "amber" },
};

const LOW_AI_CONFIDENCE = 0.85;

function normText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dayValue(date: string | null | undefined) {
  if (!date) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time)) return null;
  return Math.floor(time / 86_400_000);
}

function datesWithinDays(a: string, b: string, days: number) {
  const da = dayValue(a);
  const db = dayValue(b);
  return da !== null && db !== null && Math.abs(da - db) <= days;
}

export function areLikelyDuplicates(a: ReviewExpenseLike, b: ReviewExpenseLike) {
  if (a.id === b.id) return false;

  const invoiceA = normText(a.invoice_number);
  const invoiceB = normText(b.invoice_number);
  const vendorA = normText(a.vendor);
  const vendorB = normText(b.vendor);
  if (invoiceA && invoiceB && invoiceA === invoiceB && vendorA === vendorB) return true;

  const refA = normText(a.payment_reference);
  const refB = normText(b.payment_reference);
  if (refA && refB && refA === refB) return true;

  const amountA = asNumber(a.amount);
  const amountB = asNumber(b.amount);
  return (
    !!vendorA &&
    vendorA === vendorB &&
    amountA !== null &&
    amountB !== null &&
    amountA === amountB &&
    datesWithinDays(a.expense_date, b.expense_date, 2)
  );
}

export function findDuplicateIds(expenses: ReviewExpenseLike[]) {
  const duplicateIds = new Set<string>();

  for (let i = 0; i < expenses.length; i += 1) {
    for (let j = i + 1; j < expenses.length; j += 1) {
      if (areLikelyDuplicates(expenses[i], expenses[j])) {
        duplicateIds.add(expenses[i].id);
        duplicateIds.add(expenses[j].id);
      }
    }
  }

  return duplicateIds;
}

export function deriveReviewIssues(
  expense: ReviewExpenseLike,
  duplicateIds: Set<string>
): ReviewIssue[] {
  const issueTypes: ReviewIssueType[] = [];
  const paymentStatus = expense.payment_status ?? "paid";
  const amount = asNumber(expense.amount);
  const paidAmount = asNumber(expense.paid_amount);
  const isInvoice = expense.document_type === "invoice" || expense.expense_type === "invoice";

  if (expense.status === "needs_review" || expense.status === "missing_receipt") {
    issueTypes.push("needs_review");
  }
  if (duplicateIds.has(expense.id)) issueTypes.push("possible_duplicate");
  if (paymentStatus === "unpaid") issueTypes.push("unpaid");
  if (paymentStatus === "partially_paid") issueTypes.push("partially_paid");
  if (
    isInvoice &&
    ((paymentStatus === "paid" && paidAmount === null) ||
      (paidAmount !== null && amount !== null && paidAmount !== amount))
  ) {
    issueTypes.push("amount_mismatch");
  }
  if (
    (isInvoice && paymentStatus === "paid" && !expense.payment_proof_file_path) ||
    ((expense.document_type === "receipt" || expense.document_type === "payment_proof") &&
      !expense.receipt_file_path)
  ) {
    issueTypes.push("missing_proof");
  }
  if (expense.ai_confidence !== null && expense.ai_confidence !== undefined && expense.ai_confidence < LOW_AI_CONFIDENCE) {
    issueTypes.push("low_ai_confidence");
  }

  return [...new Set(issueTypes)].map((type) => REVIEW_ISSUES[type]);
}
