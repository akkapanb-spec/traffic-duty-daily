// Ported verbatim (algorithm-for-algorithm) from Code.gs ส่วนที่ 2.
// Same functions used by scripts/migrate.mjs — keep both in sync if this changes.

export const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export const TH_MONTH_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
export const TH_MONTH_ABBR = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];
export const TH_WEEKDAY = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
const TH_MONTH_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    map[TH_MONTH_FULL[i]] = i;
    map[TH_MONTH_ABBR[i].replace(/\./g, '')] = i;
    map[TH_MONTH_FULL[i].substring(0, 4)] = i;
  }
  return map;
})();

export function normalizeDigits(text: unknown): string {
  if (text === null || text === undefined) return '';
  let out = '';
  for (const ch of String(text)) {
    const idx = THAI_DIGITS.indexOf(ch);
    out += idx >= 0 ? String(idx) : ch;
  }
  return out;
}

export function cleanText(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/ /g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanPersonName(text: unknown): string {
  const s = cleanText(text);
  if (!s) return '';
  return s.replace(/^[๐-๙0-9]+/, (m) => normalizeDigits(m));
}

export function extractCode(text: unknown): string {
  const s = normalizeDigits(cleanText(text));
  const m = s.match(/^(\d{1,6})/);
  return m ? m[1] : '';
}

export function isBlankValue(text: unknown): boolean {
  const s = cleanText(text);
  return s === '' || s === '-' || s === '--' || s === 'ไม่มี' || s === 'ไม่มีข้อมูล';
}

export function toGregorianYear(year: number | string): number {
  const y = Number(year);
  if (isNaN(y)) return NaN;
  if (y < 100) return 1957 + y;
  if (y >= 2400 && y <= 2700) return y - 543;
  return y;
}

export function toBuddhistYear(year: number): number {
  return Number(year) + 543;
}

export function makeDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function parseThaiDate(value: unknown, defaultYearBE: number | null): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const s = normalizeDigits(cleanText(value));
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return makeDate(toGregorianYear(Number(iso[1])), Number(iso[2]), Number(iso[3]));

  const num = s.match(/^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})$/);
  if (num) {
    const mm = Number(num[2]);
    if (mm >= 1 && mm <= 12) return makeDate(toGregorianYear(Number(num[3])), mm, Number(num[1]));
    return null;
  }

  const th = s.match(/^(\d{1,2})\s*([ก-๙.\s]+?)\s*(\d{2,4})?$/);
  if (th) {
    const day = Number(th[1]);
    const monthKey = th[2].replace(/[.\s]/g, '');
    if (Object.prototype.hasOwnProperty.call(TH_MONTH_LOOKUP, monthKey)) {
      const monthIdx = TH_MONTH_LOOKUP[monthKey];
      const yearBE = th[3] ? Number(th[3]) : defaultYearBE;
      if (yearBE === null || yearBE === undefined) return null;
      if (day >= 1 && day <= 31) return makeDate(toGregorianYear(yearBE), monthIdx + 1, day);
    }
  }
  return null;
}

export function dateKey(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '';
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${date.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
}

export function addDays(date: Date, days: number): Date {
  return makeDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + days);
}

export function isOddDay(date: Date): boolean {
  return date.getDate() % 2 === 1;
}

export function oddEvenLabel(date: Date): string {
  return isOddDay(date) ? 'วันเลขคี่' : 'วันเลขคู่';
}

export function formatThaiFull(date: Date): string {
  return TH_WEEKDAY[date.getDay()] + 'ที่ ' + date.getDate() + ' ' + TH_MONTH_FULL[date.getMonth()] + ' ' + toBuddhistYear(date.getFullYear());
}

export function formatThaiShort(date: Date): string {
  return date.getDate() + ' ' + TH_MONTH_ABBR[date.getMonth()] + ' ' + toBuddhistYear(date.getFullYear());
}

export function formatThaiCompact(date: Date): string {
  const be = String(toBuddhistYear(date.getFullYear()));
  return date.getDate() + ' ' + TH_MONTH_ABBR[date.getMonth()] + be.substring(2);
}

// Bangkok "today" without relying on server TZ.
export function todayInThailand(): Date {
  const now = new Date();
  const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  return makeDate(bkk.getFullYear(), bkk.getMonth() + 1, bkk.getDate());
}
