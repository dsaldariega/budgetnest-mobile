export type CsvImportRow = {
  accountName: string;
  currency: string;
  type: "income" | "expense";
  amountMinor: number;
  category: string;
  description: string;
  occurredAt: string;
};

export type CsvExportRow = {
  accountName: string;
  currencyCode: string;
  type: "income" | "expense";
  amountMinor: number;
  categoryName: string | null;
  description: string;
  occurredAt: string;
};

export type ExportPeriod = "all" | "today" | "week" | "month" | "year" | "custom";

const REQUIRED_HEADERS = [
  "account_name",
  "currency",
  "transaction_type",
  "amount",
  "category",
  "description",
  "transaction_date",
] as const;

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((values) => values.some((value) => value.trim() !== ""));
}

function normalizeDate(value: string): string | null {
  const input = value.trim();
  const valid = (year: number, month: number, day: number): string | null => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date.toISOString().slice(0, 10)
      : null;
  };

  let match = input.match(/^([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/);
  if (match) return valid(Number(match[1]), Number(match[2]), Number(match[3]));

  match = input.match(/^([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return valid(Number(match[3]), month, day);
  }

  if (/^[0-9]+(?:\.[0-9]+)?$/.test(input)) {
    const serial = Number(input);
    if (serial >= 20000 && serial <= 80000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000)
        .toISOString()
        .slice(0, 10);
    }
  }

  return null;
}

export function normalizeImportCsv(text: string): CsvImportRow[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    throw new Error("The file does not contain any transaction rows.");
  }
  if (parsed.length > 5001) {
    throw new Error("Import is limited to 5,000 rows at a time.");
  }

  const headers = parsed[0].map((value) => value.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error("Missing required CSV columns: " + missing.join(", "));
  }

  const column = (row: string[], name: (typeof REQUIRED_HEADERS)[number]) =>
    row[headers.indexOf(name)]?.trim() ?? "";
  const normalized: CsvImportRow[] = [];
  const issues: string[] = [];

  parsed.slice(1).forEach((row, index) => {
    const csvRow = index + 2;
    const accountName = column(row, "account_name");
    const currency = column(row, "currency").toUpperCase();
    const type = column(row, "transaction_type").toLowerCase();
    const amountText = column(row, "amount");
    const category = column(row, "category");
    const description = column(row, "description");
    const dateText = column(row, "transaction_date");
    let valid = true;

    if (!accountName || accountName.length > 80) {
      issues.push(`Row ${csvRow}: enter an account name (maximum 80 characters).`);
      valid = false;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      issues.push(`Row ${csvRow}: currency must be a three-letter code.`);
      valid = false;
    }
    if (type !== "income" && type !== "expense") {
      issues.push(`Row ${csvRow}: transaction type must be income or expense.`);
      valid = false;
    }
    const amountNumber = Number(amountText);
    const amountMinor = Math.round(amountNumber * 100);
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amountNumber) || amountNumber <= 0 || !Number.isSafeInteger(amountMinor)) {
      issues.push(`Row ${csvRow}: amount must be greater than zero with up to two decimal places.`);
      valid = false;
    }
    if (!category || category.length > 80) {
      issues.push(`Row ${csvRow}: enter a category (maximum 80 characters).`);
      valid = false;
    }
    if (description.length > 240) {
      issues.push(`Row ${csvRow}: description must be 240 characters or fewer.`);
      valid = false;
    }
    const date = normalizeDate(dateText);
    if (!date) {
      issues.push(`Row ${csvRow}: use a real date in YYYY-MM-DD or MM/DD/YYYY format.`);
      valid = false;
    }

    if (valid && date) {
      normalized.push({
        accountName,
        currency,
        type: type as "income" | "expense",
        amountMinor,
        category,
        description,
        occurredAt: date,
      });
    }
  });

  if (issues.length > 0) {
    throw new Error(issues.slice(0, 8).join("\n") + (issues.length > 8 ? `\nAnd ${issues.length - 8} more issue(s).` : ""));
  }

  return normalized;
}

function csvEscape(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);

  // Prevent spreadsheet formula execution when exported text starts with a
  // formula marker, including markers preceded by control/whitespace chars.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function makeTransactionCsv(rows: CsvExportRow[]): string {
  const headers = [...REQUIRED_HEADERS];
  const lines = rows.map((row) => [
    row.accountName,
    row.currencyCode,
    row.type,
    (row.amountMinor / 100).toFixed(2),
    row.categoryName ?? "Uncategorised",
    row.description,
    row.occurredAt.slice(0, 10),
  ]);
  return "\uFEFF" + [
    headers.join(","),
    ...lines.map((line) => line.map(csvEscape).join(",")),
  ].join("\r\n");
}

export function localDateStamp(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function dateStamp(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getExportDateRange(
  period: ExportPeriod,
  customStart: string,
  customEnd: string,
  now = new Date(),
): { start: string; end: string } {
  const today = dateStamp(now);
  if (period === "all") return { start: "", end: "" };
  if (period === "today") return { start: today, end: today };
  if (period === "custom") return { start: customStart, end: customEnd };
  if (period === "month") return { start: today.slice(0, 7) + "-01", end: today };
  if (period === "year") return { start: today.slice(0, 4) + "-01-01", end: today };

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: dateStamp(monday), end: dateStamp(sunday) };
}
