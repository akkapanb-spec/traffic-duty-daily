// Ported from Code.gs ส่วนที่ 6 (LeaveService).
//
// IMPORTANT: the frontend form sends/expects `type` as the Thai label
// ('ลาราชการ' / 'ไปราชการ') directly — not the English 'leave'/'official'
// enum used internally in leave_records.type. Convert at every boundary.

import { addDays, cleanText, dateKey, formatThaiCompact, parseThaiDate, toBuddhistYear } from './dates.ts';
import type { DutyIndex } from './duty-engine.ts';
import { holidayInfo, isOwnRestDay, monthNameThai, shiftOf } from './duty-query.ts';
import { ApiError } from './db.ts';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

function toInternalType(thaiOrInternal: string): 'leave' | 'official' {
  return thaiOrInternal === 'ไปราชการ' || thaiOrInternal === 'official' ? 'official' : 'leave';
}
function toThaiType(internal: string): string {
  return internal === 'official' ? 'ไปราชการ' : 'ลาราชการ';
}
function shiftLabel(shift: 'morning' | 'afternoon' | null): string {
  return shift === 'morning' ? 'เช้า' : shift === 'afternoon' ? 'บ่าย' : 'ไม่ทราบผลัด';
}

function expandDates(startDate: string, endDate: string | undefined, defaultYearBE: number): string[] {
  const start = parseThaiDate(startDate, defaultYearBE);
  if (!start) throw new ApiError('วันที่เริ่มไม่ถูกต้อง');
  const end = endDate ? parseThaiDate(endDate, defaultYearBE) : start;
  if (!end) throw new ApiError('วันที่สิ้นสุดไม่ถูกต้อง');
  const keys: string[] = [];
  let cursor = start;
  let guard = 0;
  while (dateKey(cursor) <= dateKey(end) && guard < 120) {
    keys.push(dateKey(cursor));
    cursor = addDays(cursor, 1);
    guard++;
  }
  return keys;
}

function resolveMember(code: string, index: DutyIndex) {
  return index.personnel.find((p) => p.code === code) ?? null;
}

interface Warning { topic: string; level: 'danger' | 'warn' | 'info'; text: string }

async function existingOnDate(supabase: any, dateKey: string, excludeId?: string) {
  const { data, error } = await supabase.from('leave_records').select('*').eq('date_key', dateKey);
  if (error) throw new ApiError(error.message, 500);
  return excludeId ? (data ?? []).filter((r: any) => r.id !== excludeId) : (data ?? []);
}

export async function validateLeaveEntry(supabase: any, payload: any, index: DutyIndex, defaultYearBE: number) {
  const code = payload.code;
  if (!code) throw new ApiError('กรุณาเลือกเจ้าหน้าที่');
  const member = resolveMember(code, index);
  const days = expandDates(payload.startDate, payload.endDate, defaultYearBE);
  const excludeId = payload.excludeId;

  const perDay: any[] = [];
  const allWarnings: Warning[] = [];
  let hasDuplicate = false;

  for (const key of days) {
    const date = new Date(key + 'T12:00:00');
    const others = await existingOnDate(supabase, key, excludeId);

    const dup = others.find((r: any) => r.code === code);
    if (dup) {
      hasDuplicate = true;
      allWarnings.push({ topic: 'ข้อมูลซ้ำ', level: 'danger', text: `${member?.name ?? code} มีรายการ (${toThaiType(dup.type)}) ในวันที่ ${formatThaiCompact(date)} อยู่แล้ว` });
    }

    const myShift = shiftOf(code, date, index);
    const sameShift = myShift ? others.filter((r: any) => r.code !== code && shiftOf(r.code, date, index) === myShift) : [];
    if (sameShift.length > 0) {
      allWarnings.push({
        topic: 'ซ้ำผลัด', level: sameShift.length >= 2 ? 'danger' : 'warn',
        text: `วันที่ ${formatThaiCompact(date)} ผลัด${shiftLabel(myShift)} มีคนลา/ไปราชการแล้ว ${sameShift.length} นาย (${sameShift.map((r: any) => r.name).join(', ')}) — ท่านจะเป็นคนที่ ${sameShift.length + 1}`
      });
    }

    const prev = addDays(date, -1), next = addDays(date, 1);
    const hPrev = holidayInfo(prev, index), hNext = holidayInfo(next, index);
    if (hPrev) allWarnings.push({ topic: 'ติดวันหยุด', level: 'warn', text: `วันก่อนหน้า (${formatThaiCompact(prev)}) เป็น${hPrev}` });
    if (hNext) allWarnings.push({ topic: 'ติดวันหยุด', level: 'warn', text: `วันถัดไป (${formatThaiCompact(next)}) เป็น${hNext}` });

    if (isOwnRestDay(code, prev, index)) allWarnings.push({ topic: 'ติดวันพัก', level: 'warn', text: `วันก่อนหน้า (${formatThaiCompact(prev)}) เป็นเวรพักของท่านเอง` });
    if (isOwnRestDay(code, next, index)) allWarnings.push({ topic: 'ติดวันพัก', level: 'warn', text: `วันถัดไป (${formatThaiCompact(next)}) เป็นเวรพักของท่านเอง` });

    if (isOwnRestDay(code, date, index)) allWarnings.push({ topic: 'ตรงวันพัก', level: 'info', text: `วันที่ ${formatThaiCompact(date)} ตรงกับเวรพักของท่านเองอยู่แล้ว` });
    const hSelf = holidayInfo(date, index);
    if (hSelf) allWarnings.push({ topic: 'ตรงวันหยุด', level: 'info', text: `วันที่ ${formatThaiCompact(date)} ตรงกับ${hSelf}อยู่แล้ว` });

    perDay.push({ dateKey: key, dateText: formatThaiCompact(date), shift: shiftLabel(myShift), sameShiftCount: sameShift.length, myOrder: sameShift.length + 1 });
  }

  return {
    ok: true,
    person: { code, name: member?.name ?? code, source: member?.source ?? 'ไม่ทราบผลัด', point: member?.point ?? '' },
    startText: perDay[0]?.dateText ?? '', endText: perDay[perDay.length - 1]?.dateText ?? '', totalDays: perDay.length,
    perDay, warnings: allWarnings, hasDuplicate, needConfirm: allWarnings.length > 0
  };
}

export async function saveLeaveEntry(supabase: any, payload: any, index: DutyIndex, defaultYearBE: number) {
  if (!payload.confirmed) throw new ApiError('กรุณายืนยันก่อนบันทึก');
  const member = resolveMember(payload.code, index);
  const days = expandDates(payload.startDate, payload.endDate, defaultYearBE);
  const type = toInternalType(payload.type);
  const groupId = genId(type === 'official' ? 'GD' : 'GL');
  const rows = days.map((key) => ({
    group_id: groupId, type, date_key: key, code: payload.code,
    name: member?.name ?? payload.code,
    point: cleanText(payload.point) || member?.point || null,
    detail: cleanText(payload.detail) || null
  }));
  const { error } = await supabase.from('leave_records').insert(rows);
  if (error) throw new ApiError(error.message, 500);
  return { ok: true, groupId, count: rows.length, message: `บันทึก${toThaiType(type)}เรียบร้อย ${rows.length} วัน` };
}

export async function updateLeaveEntry(supabase: any, payload: any, index: DutyIndex, defaultYearBE: number) {
  if (!payload.id) throw new ApiError('ไม่พบรหัสรายการ');
  const member = resolveMember(payload.code, index);
  const type = toInternalType(payload.type);
  const dateKeyVal = expandDates(payload.startDate, undefined, defaultYearBE)[0];
  const { error } = await supabase.from('leave_records').update({
    type, date_key: dateKeyVal, code: payload.code,
    name: member?.name ?? payload.code,
    point: cleanText(payload.point) || member?.point || null,
    detail: cleanText(payload.detail) || null,
    updated_at: new Date().toISOString()
  }).eq('id', payload.id);
  if (error) throw new ApiError(error.message, 500);
  return { ok: true, message: 'แก้ไขรายการเรียบร้อย' };
}

export async function deleteLeaveEntry(supabase: any, payload: any) {
  if (payload.groupId) {
    const { error } = await supabase.from('leave_records').delete().eq('group_id', payload.groupId);
    if (error) throw new ApiError(error.message, 500);
    return { ok: true, message: 'ลบทั้งชุดเรียบร้อย' };
  }
  if (payload.id) {
    const { error } = await supabase.from('leave_records').delete().eq('id', payload.id);
    if (error) throw new ApiError(error.message, 500);
    return { ok: true, message: 'ลบรายการเรียบร้อย' };
  }
  throw new ApiError('ไม่พบรหัสรายการหรือรหัสชุด');
}

interface PersonAgg { code: string; name: string; leave: number; official: number; total: number; dates: { dateKey: string; dateText: string; type: string }[] }

function aggregateByPerson(rows: any[]): PersonAgg[] {
  const byPerson = new Map<string, PersonAgg>();
  for (const r of rows) {
    const cur = byPerson.get(r.code) ?? { code: r.code, name: r.name, leave: 0, official: 0, total: 0, dates: [] };
    if (r.type === 'leave') cur.leave++; else cur.official++;
    cur.total++;
    cur.dates.push({ dateKey: r.date_key, dateText: formatThaiCompact(new Date(r.date_key + 'T12:00:00')), type: toThaiType(r.type) });
    byPerson.set(r.code, cur);
  }
  return Array.from(byPerson.values()).sort((a, b) => b.total - a.total);
}

export async function getAllLeaveData(supabase: any, yearBE: number) {
  const yearCE = yearBE - 543;
  const { data, error } = await supabase.from('leave_records').select('*')
    .gte('date_key', `${yearCE}-01-01`).lte('date_key', `${yearCE}-12-31`).order('date_key');
  if (error) throw new ApiError(error.message, 500);
  const rows = data ?? [];

  const monthly = Array.from({ length: 12 }, (_, i) => ({ name: monthNameThai(i + 1), leave: 0, official: 0 }));
  for (const r of rows) {
    const m = Number(r.date_key.slice(5, 7)) - 1;
    if (r.type === 'leave') monthly[m].leave++; else monthly[m].official++;
  }
  const totalLeave = rows.filter((r: any) => r.type === 'leave').length;
  const totalOfficial = rows.filter((r: any) => r.type === 'official').length;

  return {
    ok: true, yearBE, availableYears: [yearBE - 1, yearBE, yearBE + 1],
    monthly, totalLeave, totalOfficial, people: aggregateByPerson(rows)
  };
}

export async function getPersonLeaveDetail(supabase: any, code: string, yearBE: number) {
  const yearCE = Number(yearBE) - 543;
  const { data, error } = await supabase.from('leave_records').select('*').eq('code', code)
    .gte('date_key', `${yearCE}-01-01`).lte('date_key', `${yearCE}-12-31`).order('date_key');
  if (error) throw new ApiError(error.message, 500);
  const rows = data ?? [];
  const monthly = Array.from({ length: 12 }, (_, i) => ({ name: monthNameThai(i + 1), leave: 0, official: 0 }));
  for (const r of rows) {
    const m = Number(r.date_key.slice(5, 7)) - 1;
    if (r.type === 'leave') monthly[m].leave++; else monthly[m].official++;
  }
  return {
    ok: true, name: rows[0]?.name ?? code, yearBE: Number(yearBE),
    totalLeave: rows.filter((r: any) => r.type === 'leave').length,
    totalOfficial: rows.filter((r: any) => r.type === 'official').length,
    monthly,
    records: rows.map((r: any) => ({ dateText: formatThaiCompact(new Date(r.date_key + 'T12:00:00')), type: toThaiType(r.type), point: r.point, detail: r.detail }))
  };
}

export async function searchLeaveRecords(supabase: any, keyword: string, dateText: string, index: DutyIndex, defaultYearBE: number) {
  let q = supabase.from('leave_records').select('*');
  if (keyword) q = q.or(`name.ilike.%${keyword}%,code.ilike.%${keyword}%`);
  const searchDate = dateText ? parseThaiDate(dateText, defaultYearBE) : null;
  if (searchDate) q = q.eq('date_key', dateKey(searchDate));
  const { data, error } = await q.order('date_key', { ascending: false });
  if (error) throw new ApiError(error.message, 500);

  const rows = (data ?? []).map((r: any) => ({
    id: r.id, groupId: r.group_id, type: toThaiType(r.type), code: r.code, name: r.name,
    point: r.point, detail: r.detail, dateKey: r.date_key,
    dateText: formatThaiCompact(new Date(r.date_key + 'T12:00:00')), editable: true
  }));

  // Inject non-editable "เวรพัก" pseudo-rows from rpj1/rpj2 rest days.
  const restRows: any[] = [];
  for (const m of [...index.rpj1, ...index.rpj2]) {
    if (keyword && !(m.code.includes(keyword) || m.name.includes(keyword))) continue;
    for (const key of m.restKeys) {
      if (searchDate && dateKey(searchDate) !== key) continue;
      restRows.push({
        type: 'เวรพัก', dateKey: key, code: m.code, name: m.name, point: m.point,
        dateText: formatThaiCompact(new Date(key + 'T12:00:00')), editable: false
      });
    }
  }

  const allRows = [...rows, ...restRows];
  return { ok: true, keyword, dateText: dateText || 'ทั้งหมด', count: allRows.length, rows: allRows };
}
