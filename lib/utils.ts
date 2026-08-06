import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Broadcasts the *actual* Pending-tab count a stage page just computed, so
 * the sidebar badge for that stage can mirror it exactly instead of relying
 * solely on its own separately-derived (and easily out-of-sync) count.
 * Call this from a stage page's render/effect whenever its `pending` list
 * changes — Sidebar listens for "pendingCountUpdate" and merges it in.
 */
export function reportPendingCount(stageName: string, count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pendingCountUpdate", { detail: { stageName, count } }));
}

/**
 * Extracts a human-readable message from any thrown value, including
 * Supabase/Postgrest error objects (which don't stringify usefully via
 * console.error and just show up as "Object" in the browser console).
 */
export function getErrorMessage(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const err = e as any;
  return (
    err.message ||
    err.error_description ||
    err.details ||
    err.hint ||
    (err.code ? `Error code: ${err.code}` : "") ||
    (() => {
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    })()
  );
}

/**
 * Parses dates from Google Sheets, handling DD/MM/YYYY and other common formats.
 */
export function parseSheetDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr || dateStr === "-" || dateStr === "—" || dateStr === "Invalid Date") return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  
  // Try standard parsing
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Try parsing DD/MM/YYYY
  const dateTimeParts = dateStr.includes(", ") ? dateStr.split(", ") : dateStr.split(" ");
  const dateParts = dateTimeParts[0].split("/");
  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);

    let hours = 0, mins = 0, secs = 0;
    if (dateTimeParts[1]) {
      const timeParts = dateTimeParts[1].split(":");
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        mins = parseInt(timeParts[1], 10);
        if (timeParts[2]) secs = parseInt(timeParts[2], 10);

        if (dateTimeParts[1].toLowerCase().includes("pm") && hours < 12) hours += 12;
        if (dateTimeParts[1].toLowerCase().includes("am") && hours === 12) hours = 0;
      }
    }

    const parsed = new Date(year, month, day, hours, mins, secs);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Formats a date to DD/MM/YYYY for display.
 */
export function formatDate(date?: Date | string | null): string {
  if (!date || date === "-" || date === "—") return "";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
}
/**
 * Generates a timestamp compatible with FMS sheets (YYYY-MM-DD HH:mm:ss).
 */
export function getFmsTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
/**
 * Formats a date to DD/MM/YYYY, HH:mm:ss for display.
 */
export function formatDateTimeFull(date?: Date | string | null): string {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) {
    if (typeof date === "string") {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        const dd = String(parsed.getDate()).padStart(2, "0");
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const yyyy = parsed.getFullYear();
        const hh = String(parsed.getHours()).padStart(2, "0");
        const min = String(parsed.getMinutes()).padStart(2, "0");
        const ss = String(parsed.getSeconds()).padStart(2, "0");
        return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
      }
      return date;
    }
    return "-";
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

/**
 * Calculates Planned Date according to TAT rule and returns DD/MM/YYYY, HH:mm:ss.
 */
export function calculatePlannedDate(
  createdAtStr: string | Date | null | undefined,
  tatRule?: { completion_time?: number; time_unit?: string } | null,
  defaultHours: number = 24
): string {
  const baseDate = parseSheetDate(createdAtStr) || (createdAtStr ? new Date(createdAtStr) : null);
  if (!baseDate || isNaN(baseDate.getTime())) return "-";

  const compTime = Number(tatRule?.completion_time) || defaultHours;
  const timeUnit = String(tatRule?.time_unit || "Hours").toLowerCase();

  const planned = new Date(baseDate.getTime());
  if (timeUnit.includes("min")) {
    planned.setMinutes(planned.getMinutes() + compTime);
  } else if (timeUnit.includes("day")) {
    planned.setDate(planned.getDate() + compTime);
  } else {
    planned.setHours(planned.getHours() + compTime);
  }

  return formatDateTimeFull(planned);
}

/**
 * Gets cumulative formatted planned date (dd/mm/yyyy, hh:mm:ss) for a record based on configured TAT rules up to stageName.
 */
export function getPlannedDateForRecord(
  recordData: any,
  stageName: string,
  tatRules?: any[],
  createdAtFallback?: any
): string {
  const rawDate = recordData?.createdAt || recordData?.timestamp || recordData?.indentDate || createdAtFallback;
  const baseDate = parseSheetDate(rawDate) || (rawDate ? new Date(rawDate) : null);
  
  if (!baseDate || isNaN(baseDate.getTime())) return "-";

  // Must mirror STAGES in lib/constants.ts (the actual workflow/sidebar order) —
  // Purchase Return (rejected-qty handling straight off Material Received) always
  // resolves before Billing, so its TAT has to accrue first in the cumulative sum.
  const stageOrder = [
    "Create Indent",
    "Indent Approval",
    "Quotation",
    "Approved Vendor",
    "Make PO",
    "Payment",
    "Follow UP / Lifting",
    "Transporter Follow-Up",
    "Material Received",
    "Purchase Return",
    "Billing",
    "Order Cancel"
  ];

  const targetIndex = stageOrder.findIndex(
    (s) => s.toLowerCase().trim() === String(stageName).toLowerCase().trim()
  );

  let currentDate = new Date(baseDate.getTime());
  const maxIdx = targetIndex >= 0 ? targetIndex : 0;

  for (let i = 0; i <= maxIdx; i++) {
    const sName = stageOrder[i];
    const rule = tatRules?.find(
      (r) => String(r.section_name || "").toLowerCase().trim() === sName.toLowerCase().trim()
    );

    if (rule && rule.completion_time && !isNaN(Number(rule.completion_time))) {
      const compTime = Number(rule.completion_time);
      const timeUnit = String(rule.time_unit || "Hours").toLowerCase();

      if (timeUnit.includes("min")) {
        currentDate.setMinutes(currentDate.getMinutes() + compTime);
      } else if (timeUnit.includes("day")) {
        currentDate.setDate(currentDate.getDate() + compTime);
      } else {
        currentDate.setHours(currentDate.getHours() + compTime);
      }
    }
  }

  return formatDateTimeFull(currentDate);
}

/**
 * Checks if a warranty expiry date is within one month from today.
 */
export function isWarrantyExpiringSoon(expiryDate: string | Date | null | undefined): boolean {
  if (!expiryDate || expiryDate === "-" || expiryDate === "—") return false;
  try {
    const d = expiryDate instanceof Date ? expiryDate : parseSheetDate(expiryDate);
    if (!d || isNaN(d.getTime())) return false;
    const today = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    return d <= oneMonthFromNow;
  } catch (e) {
    return false;
  }
}
