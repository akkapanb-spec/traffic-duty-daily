// Ported from Code.gs ส่วนที่ 10 (ImportExcel) — instead of "convert to
// Google Sheet then copy sheet-to-sheet", this parses the uploaded workbook
// directly (SheetJS in Deno) and replaces matching tables' rows. Sheets not
// present in the upload are left untouched, same as the original.

import XLSX from 'npm:xlsx@0.18.5';
import { cleanText, cleanPersonName, dateKey, extractCode, isBlankValue, parseThaiDate, toBuddhistYear } from './dates.ts';
import { ApiError, verifyPin } from './db.ts';

function findSheet(wb: any, name: string): any[][] | null {
  const target = name.replace(/\s+/g, '');
  const found = wb.SheetNames.find((n: string) => n.replace(/\s+/g, '') === target);
  if (!found) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[found], { header: 1, raw: false, defval: '' });
}

function parseRestDayList(value: unknown, defaultYearBE: number): string[] {
  const s = cleanText(value);
  if (isBlankValue(s)) return [];
  const parts = s.split(/[,、\/]|และ/);
  const keys: string[] = [];
  let lastMonthText = '';
  let lastYearBE = defaultYearBE;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = cleanText(parts[i]);
    if (!p) continue;
    const yearMatch = p.match(/(\d{2,4})\s*$/);
    const monthMatch = p.match(/([ก-๙]{1,10}\.?[ก-๙]?\.?)/);
    if (yearMatch && monthMatch) lastYearBE = Number(yearMatch[1]);
    if (monthMatch) lastMonthText = monthMatch[1];
    let text = p;
    if (!monthMatch && lastMonthText) text = p + ' ' + lastMonthText;
    const d = parseThaiDate(text, lastYearBE);
    if (d) keys.push(dateKey(d));
  }
  return keys.reverse();
}

const MAX_UPLOAD_MB = 20;

export async function importExcelFile(supabase: any, payload: any) {
  const startedAt = Date.now();
  if (!verifyPin(payload?.pin)) throw new ApiError('รหัส PIN ไม่ถูกต้อง', 401);
  const { fileName, mimeType, data } = payload;
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  ];
  if (!allowed.includes(mimeType) && !/\.(xlsx|xlsm|xls)$/i.test(fileName ?? '')) {
    throw new ApiError('รองรับเฉพาะไฟล์ Excel (.xlsx/.xlsm/.xls)');
  }
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  if (bytes.length > MAX_UPLOAD_MB * 1024 * 1024) throw new ApiError(`ไฟล์ใหญ่เกิน ${MAX_UPLOAD_MB}MB`);

  const wb = XLSX.read(bytes, { type: 'array' });
  const defaultYearBE = (() => {
    const rows = findSheet(wb, 'ลาราชการ');
    if (rows) for (const r of rows.slice(1)) { const d = parseThaiDate(r[0], null); if (d) return toBuddhistYear(d.getFullYear()); }
    return toBuddhistYear(new Date().getFullYear());
  })();

  const replaced: string[] = [];

  async function replaceTable(table: string, rows: any[]) {
    const del = await supabase.from(table).delete().neq('id', -1);
    if (del.error && del.error.code !== '42P01') throw new ApiError(`ล้างตาราง ${table} ไม่สำเร็จ: ${del.error.message}`, 500);
    if (rows.length) {
      const ins = await supabase.from(table).insert(rows);
      if (ins.error) throw new ApiError(`เขียนตาราง ${table} ไม่สำเร็จ: ${ins.error.message}`, 500);
    }
    replaced.push(table);
  }

  const rpj1 = findSheet(wb, 'การปฏิบัติหน้าที่ตามรปจ.1');
  if (rpj1) await replaceTable('officers_rpj1', rpj1.slice(1).filter((r) => !isBlankValue(r[1])).map((r) => ({
    seq: Number(r[0]) || null, code: extractCode(r[1]), name: cleanPersonName(r[1]),
    point: cleanText(r[2]) || null, rest_note: cleanText(r[3]) || null, rest_dates: parseRestDayList(r[3], defaultYearBE)
  })));

  const rpj2 = findSheet(wb, 'การปฏิบัติหน้าที่ตามรปจ.2');
  if (rpj2) await replaceTable('officers_rpj2', rpj2.slice(1).filter((r) => !isBlankValue(r[1])).map((r) => ({
    seq: Number(r[0]) || null, code: extractCode(r[1]), name: cleanPersonName(r[1]),
    point: cleanText(r[2]) || null, rest_note: cleanText(r[3]) || null, rest_dates: parseRestDayList(r[3], defaultYearBE)
  })));

  const rushSpecs: [string, string, string][] = [
    ['เร่งด่วนเช้า(วันคี่)', 'am', 'odd'], ['เร่งด่วนบ่าย(วันคี่)', 'pm', 'odd'],
    ['เร่งด่วนเช้า(วันคู่)', 'am', 'even'], ['เร่งด่วนบ่าย(วันคู่)', 'pm', 'even']
  ];
  const rushRows: any[] = [];
  let anyRush = false;
  for (const [sheetName, shift, dayType] of rushSpecs) {
    const rows = findSheet(wb, sheetName);
    if (!rows) continue;
    anyRush = true;
    for (const r of rows.slice(1)) {
      if (isBlankValue(r[1])) continue;
      rushRows.push({
        shift, day_type: dayType, seq: Number(r[0]) || null, code: extractCode(r[1]), name: cleanPersonName(r[1]),
        point: cleanText(r[2]) || null, rest_note: cleanText(r[3]) || null, rest_dates: parseRestDayList(r[3], defaultYearBE)
      });
    }
  }
  if (anyRush) await replaceTable('rush_points', rushRows);

  const roster = findSheet(wb, 'รายชื่ออจราจร') ?? findSheet(wb, 'รายชื่อจราจร');
  if (roster) await replaceTable('roster', roster.slice(1).filter((r) => !isBlankValue(r[0])).map((r) => ({
    code: extractCode(r[0]), name: cleanPersonName(r[0]), position: cleanText(r[1]) || null
  })));

  return { ok: true, replaced: replaced.length, created: 0, elapsedMs: Date.now() - startedAt, backupUrl: null, fileName };
}
