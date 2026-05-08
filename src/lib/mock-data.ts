// ─── Expenses ────────────────────────────────────────────────────────────────

export type ExpenseStatus = "Verified" | "Needs Review" | "Pending";
export type PaymentMethod = "Credit Card" | "Bank Transfer" | "Cash" | "UPI";
export type ExpenseCategory =
  | "Software"
  | "Travel"
  | "Office Supplies"
  | "Marketing"
  | "Utilities"
  | "Meals & Entertainment"
  | "Salary"
  | "Rent"
  | "Miscellaneous";

export interface Expense {
  id: string;
  date: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  description: string;
  receiptAvailable: boolean;
}

export const EXPENSES: Expense[] = [
  { id: "E001", date: "2026-05-01", vendor: "AWS", category: "Software", amount: 18400, paymentMethod: "Credit Card", status: "Verified", description: "Cloud infrastructure – May", receiptAvailable: true },
  { id: "E002", date: "2026-05-02", vendor: "Swiggy Business", category: "Meals & Entertainment", amount: 3200, paymentMethod: "UPI", status: "Needs Review", description: "Team lunch – onboarding", receiptAvailable: true },
  { id: "E003", date: "2026-05-03", vendor: "Notion", category: "Software", amount: 4800, paymentMethod: "Credit Card", status: "Verified", description: "Annual plan", receiptAvailable: true },
  { id: "E004", date: "2026-05-05", vendor: "IndiGo Airlines", category: "Travel", amount: 12600, paymentMethod: "Credit Card", status: "Verified", description: "BLR–DEL client visit", receiptAvailable: true },
  { id: "E005", date: "2026-05-06", vendor: "Staples India", category: "Office Supplies", amount: 2800, paymentMethod: "Cash", status: "Needs Review", description: "Stationery restock", receiptAvailable: false },
  { id: "E006", date: "2026-05-07", vendor: "Google Ads", category: "Marketing", amount: 24000, paymentMethod: "Credit Card", status: "Verified", description: "May ad spend", receiptAvailable: true },
  { id: "E007", date: "2026-05-08", vendor: "BSNL Broadband", category: "Utilities", amount: 3500, paymentMethod: "Bank Transfer", status: "Verified", description: "Internet – May", receiptAvailable: true },
  { id: "E008", date: "2026-05-09", vendor: "Zomato Business", category: "Meals & Entertainment", amount: 5400, paymentMethod: "UPI", status: "Needs Review", description: "Investor dinner", receiptAvailable: true },
  { id: "E009", date: "2026-05-10", vendor: "Figma", category: "Software", amount: 7200, paymentMethod: "Credit Card", status: "Verified", description: "Annual plan – 3 seats", receiptAvailable: true },
  { id: "E010", date: "2026-05-11", vendor: "Ola Corporate", category: "Travel", amount: 4100, paymentMethod: "UPI", status: "Pending", description: "Office commute pool", receiptAvailable: false },
  { id: "E011", date: "2026-05-12", vendor: "DHL Express", category: "Office Supplies", amount: 1800, paymentMethod: "Credit Card", status: "Verified", description: "Document courier", receiptAvailable: true },
  { id: "E012", date: "2026-05-14", vendor: "Meta Ads", category: "Marketing", amount: 18000, paymentMethod: "Credit Card", status: "Verified", description: "Social media campaign", receiptAvailable: true },
  { id: "E013", date: "2026-05-15", vendor: "Urban Company", category: "Miscellaneous", amount: 2400, paymentMethod: "UPI", status: "Needs Review", description: "Office cleaning service", receiptAvailable: false },
  { id: "E014", date: "2026-05-16", vendor: "Slack", category: "Software", amount: 6600, paymentMethod: "Credit Card", status: "Verified", description: "Pro plan – 10 users", receiptAvailable: true },
  { id: "E015", date: "2026-05-18", vendor: "HDFC Bank", category: "Miscellaneous", amount: 5500, paymentMethod: "Bank Transfer", status: "Verified", description: "Bank charges", receiptAvailable: true },
  { id: "E016", date: "2026-05-19", vendor: "MakeMyTrip", category: "Travel", amount: 15200, paymentMethod: "Credit Card", status: "Needs Review", description: "Hotel – Mumbai trip", receiptAvailable: true },
  { id: "E017", date: "2026-05-20", vendor: "LinkedIn Ads", category: "Marketing", amount: 12000, paymentMethod: "Credit Card", status: "Verified", description: "Sponsored content – May", receiptAvailable: true },
  { id: "E018", date: "2026-05-22", vendor: "1mg", category: "Miscellaneous", amount: 1200, paymentMethod: "UPI", status: "Pending", description: "First aid kit", receiptAvailable: false },
];

// ─── Salary ──────────────────────────────────────────────────────────────────

export interface SalaryRecord {
  id: string;
  employee: string;
  designation: string;
  department: string;
  amount: number;
  month: string;
  paidOn: string;
  status: "Paid" | "Pending" | "On Hold";
}

export const SALARY_RECORDS: SalaryRecord[] = [
  { id: "S001", employee: "Arjun Mehta", designation: "Engineering Lead", department: "Engineering", amount: 85000, month: "May 2026", paidOn: "2026-05-01", status: "Paid" },
  { id: "S002", employee: "Priya Sharma", designation: "Product Manager", department: "Product", amount: 75000, month: "May 2026", paidOn: "2026-05-01", status: "Paid" },
  { id: "S003", employee: "Rohan Verma", designation: "Frontend Developer", department: "Engineering", amount: 55000, month: "May 2026", paidOn: "2026-05-01", status: "Paid" },
  { id: "S004", employee: "Sneha Patel", designation: "Designer", department: "Design", amount: 50000, month: "May 2026", paidOn: "2026-05-01", status: "Paid" },
  { id: "S005", employee: "Aditya Kumar", designation: "Backend Developer", department: "Engineering", amount: 60000, month: "May 2026", paidOn: "—", status: "Pending" },
  { id: "S006", employee: "Kavita Nair", designation: "Marketing Manager", department: "Marketing", amount: 52000, month: "May 2026", paidOn: "2026-05-01", status: "Paid" },
  { id: "S007", employee: "Vikram Singh", designation: "Sales Executive", department: "Sales", amount: 40000, month: "May 2026", paidOn: "—", status: "Pending" },
  { id: "S008", employee: "Deepa Rao", designation: "HR Manager", department: "HR", amount: 48000, month: "May 2026", paidOn: "2026-05-01", status: "Paid" },
];

// ─── Monthly Trend ────────────────────────────────────────────────────────────

export interface MonthlyData {
  month: string;
  salary: number;
  nonSalary: number;
}

export const MONTHLY_TREND: MonthlyData[] = [
  { month: "Dec", salary: 195000, nonSalary: 148000 },
  { month: "Jan", salary: 200000, nonSalary: 162000 },
  { month: "Feb", salary: 200000, nonSalary: 155000 },
  { month: "Mar", salary: 210000, nonSalary: 188000 },
  { month: "Apr", salary: 215000, nonSalary: 198000 },
  { month: "May", salary: 220000, nonSalary: 212000 },
];

// ─── Salary Trend ─────────────────────────────────────────────────────────────

export interface SalaryTrendPoint {
  month: string;
  total: number;
}

export const SALARY_TREND: SalaryTrendPoint[] = [
  { month: "Dec", total: 195000 },
  { month: "Jan", total: 200000 },
  { month: "Feb", total: 200000 },
  { month: "Mar", total: 210000 },
  { month: "Apr", total: 215000 },
  { month: "May", total: 220000 },
];

// ─── Category Split ───────────────────────────────────────────────────────────

export const CATEGORY_SPLIT = [
  { name: "Software", value: 37000, color: "#4ade80" },
  { name: "Marketing", value: 54000, color: "#86efac" },
  { name: "Travel", value: 31900, color: "#bbf7d0" },
  { name: "Meals", value: 8600, color: "#fcd34d" },
  { name: "Office", value: 4600, color: "#fdba74" },
  { name: "Utilities", value: 3500, color: "#d1d5db" },
  { name: "Other", value: 9100, color: "#e5e7eb" },
];

// ─── Payment Method Split ─────────────────────────────────────────────────────

export const PAYMENT_SPLIT = [
  { name: "Credit Card", value: 144200, color: "#4ade80" },
  { name: "Bank Transfer", value: 27000, color: "#86efac" },
  { name: "UPI", value: 22300, color: "#fcd34d" },
  { name: "Cash", value: 2800, color: "#d1d5db" },
];

// ─── Top Vendors ──────────────────────────────────────────────────────────────

export const TOP_VENDORS = [
  { vendor: "Google Ads", category: "Marketing", amount: 24000 },
  { vendor: "Meta Ads", category: "Marketing", amount: 18000 },
  { vendor: "AWS", category: "Software", amount: 18400 },
  { vendor: "MakeMyTrip", category: "Travel", amount: 15200 },
  { vendor: "LinkedIn Ads", category: "Marketing", amount: 12000 },
];

// ─── Needs Review Queue ───────────────────────────────────────────────────────

export const NEEDS_REVIEW = EXPENSES.filter((e) => e.status === "Needs Review");

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export const DASHBOARD_SUMMARY = {
  totalExpenses: 432000,
  salary: 220000,
  nonSalary: 212000,
  needsReview: 18500,
};
