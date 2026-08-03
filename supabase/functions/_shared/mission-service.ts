// Ported from Code.gs ส่วนที่ 7 (MissionService). One intentional deviation
// from the original: deleteMission hard-deletes the row instead of blanking
// it while keeping the date — that trick existed only to avoid breaking a
// Google Sheet's fixed row-per-day layout, which doesn't apply to Postgres.

import { addDays, cleanText, dateKey, formatThaiCompact, formatThaiFull, isBlankValue, parseThaiDate } from './dates.ts';
import { ApiError } from './db.ts';

export const MISSION_TYPES = ['ว.42', 'อำนวยการจราจร', 'เข้าร่วมประชุม', 'วิทยากร'];

// DB rows use date_key/time_text/image1_url/image2_url; the frontend's
// renderMissionList/editMission expect dateText/time/image1/image2.
export function toClientShape(row: any) {
  return {
    id: row.id, groupId: row.group_id, dateKey: row.date_key,
    dateText: formatThaiCompact(new Date(row.date_key + 'T12:00:00')),
    type: row.type, detail: row.detail, contact: row.contact, phone: row.phone, owner: row.owner,
    image1: row.image1_url, image2: row.image2_url, time: row.time_text, place: row.place
  };
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

async function uploadImages(supabase: any, images: { name: string; mimeType: string; data: string }[] | undefined): Promise<(string | null)[]> {
  if (!images || images.length === 0) return [null, null];
  const urls: (string | null)[] = [null, null];
  for (let i = 0; i < Math.min(2, images.length); i++) {
    const img = images[i];
    const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
    const path = `${Date.now()}-${i}-${img.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('mission-photos').upload(path, bytes, { contentType: img.mimeType, upsert: false });
    if (error) throw new ApiError(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`, 500);
    const { data: pub } = supabase.storage.from('mission-photos').getPublicUrl(path);
    urls[i] = pub.publicUrl;
  }
  return urls;
}

export async function saveMission(supabase: any, payload: any, defaultYearBE: number) {
  const type = cleanText(payload.type);
  const detail = cleanText(payload.detail);
  if (isBlankValue(type) || isBlankValue(detail)) throw new ApiError('กรุณากรอกประเภทภารกิจและรายละเอียด');

  const start = parseThaiDate(payload.startDate, defaultYearBE);
  if (!start) throw new ApiError('วันที่เริ่มไม่ถูกต้อง');
  const end = payload.endDate ? parseThaiDate(payload.endDate, defaultYearBE) : start;
  if (!end) throw new ApiError('วันที่สิ้นสุดไม่ถูกต้อง');

  const [image1_url, image2_url] = await uploadImages(supabase, payload.images);
  const groupId = genId('GM');
  const rows: any[] = [];
  let cursor = start;
  let guard = 0;
  while (dateKey(cursor) <= dateKey(end) && guard < 120) {
    rows.push({
      group_id: groupId, date_key: dateKey(cursor), type, detail,
      contact: cleanText(payload.contact) || null, phone: cleanText(payload.phone) || null,
      owner: cleanText(payload.owner) || null, image1_url, image2_url,
      time_text: cleanText(payload.time) || null, place: cleanText(payload.place) || null
    });
    cursor = addDays(cursor, 1);
    guard++;
  }
  const { error } = await supabase.from('missions').insert(rows);
  if (error) throw new ApiError(error.message, 500);
  return { ok: true, groupId, count: rows.length, message: `บันทึกภารกิจเรียบร้อย ${rows.length} วัน` };
}

export async function updateMission(supabase: any, payload: any, defaultYearBE: number) {
  if (!payload.id) throw new ApiError('ไม่พบรหัสรายการ');
  const type = cleanText(payload.type);
  const detail = cleanText(payload.detail);
  if (isBlankValue(type) || isBlankValue(detail)) throw new ApiError('กรุณากรอกประเภทภารกิจและรายละเอียด');

  const update: any = {
    type, detail,
    contact: cleanText(payload.contact) || null, phone: cleanText(payload.phone) || null,
    owner: cleanText(payload.owner) || null,
    time_text: cleanText(payload.time) || null, place: cleanText(payload.place) || null,
    updated_at: new Date().toISOString()
  };
  if (payload.startDate) {
    const d = parseThaiDate(payload.startDate, defaultYearBE);
    if (d) update.date_key = dateKey(d);
  }
  if (payload.images && payload.images.length > 0) {
    const [image1_url, image2_url] = await uploadImages(supabase, payload.images);
    update.image1_url = image1_url;
    update.image2_url = image2_url;
  }
  const { error } = await supabase.from('missions').update(update).eq('id', payload.id);
  if (error) throw new ApiError(error.message, 500);
  return { ok: true, message: 'แก้ไขภารกิจเรียบร้อย' };
}

export async function deleteMission(supabase: any, payload: any) {
  if (payload.groupId) {
    const { error } = await supabase.from('missions').delete().eq('group_id', payload.groupId);
    if (error) throw new ApiError(error.message, 500);
    return { ok: true, message: 'ลบภารกิจทั้งชุดเรียบร้อย' };
  }
  if (payload.id) {
    const { error } = await supabase.from('missions').delete().eq('id', payload.id);
    if (error) throw new ApiError(error.message, 500);
    return { ok: true, message: 'ลบภารกิจเรียบร้อย' };
  }
  throw new ApiError('ไม่พบรหัสรายการหรือรหัสชุด');
}

function weekBounds(date: Date): [Date, Date] {
  const dow = date.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(date, mondayOffset);
  const sunday = addDays(monday, 6);
  return [monday, sunday];
}

function summarize(rows: any[]) {
  const byType = new Map<string, number>();
  for (const r of rows) {
    const t = r.type && !isBlankValue(r.type) ? r.type : 'ไม่ระบุประเภท';
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const types = Array.from(byType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  return { total: rows.length, types, records: rows };
}

export async function getMissionStats(supabase: any, dateText: string, defaultYearBE: number) {
  const refDate = dateText ? (parseThaiDate(dateText, defaultYearBE) ?? new Date()) : new Date();
  const refKey = dateKey(refDate);
  const [monday, sunday] = weekBounds(refDate);
  const monthPrefix = refKey.slice(0, 7);

  const { data: monthRows, error } = await supabase
    .from('missions').select('*')
    .gte('date_key', `${monthPrefix}-01`).lte('date_key', `${monthPrefix}-31`)
    .order('date_key');
  if (error) throw new ApiError(error.message, 500);

  const todayRows = (monthRows ?? []).filter((r: any) => r.date_key === refKey);
  const weekRows = (monthRows ?? []).filter((r: any) => r.date_key >= dateKey(monday) && r.date_key <= dateKey(sunday));

  return {
    ok: true, refDate: refKey, refText: formatThaiCompact(refDate),
    today: summarize(todayRows), week: summarize(weekRows), month: summarize(monthRows ?? []),
    weekText: `${formatThaiCompact(monday)} - ${formatThaiCompact(sunday)}`,
    monthText: formatThaiFull(refDate).split('ที่')[1]?.trim() ?? monthPrefix,
    knownTypes: MISSION_TYPES
  };
}
