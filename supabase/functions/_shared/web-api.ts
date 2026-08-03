// Ported from Code.gs ส่วนที่ 11 (WebApi) — the composition layer the
// frontend actually calls. One function per google.script.run entry point.

import { dateKey, formatThaiFull, oddEvenLabel, parseThaiDate, todayInThailand, toBuddhistYear } from './dates.ts';
import { buildIndex, type DutyIndex } from './duty-engine.ts';
import { getAbsenceSummary, getLeaveCalendar } from './duty-query.ts';
import { buildLineMessages, buildReportText } from './message-builder.ts';
import * as LeaveService from './leave-service.ts';
import * as MissionService from './mission-service.ts';
import { ApiError, verifyPin } from './db.ts';
import { pushToGroup } from './line-bot.ts';

function requirePin(payload: any) {
  if (!verifyPin(payload?.pin)) throw new ApiError('รหัส PIN ไม่ถูกต้อง', 401);
}

async function loadIndex(supabase: any): Promise<DutyIndex> {
  return buildIndex(supabase);
}

function defaultYearBEFromIndex(): number {
  return toBuddhistYear(todayInThailand().getFullYear());
}

async function monthSummary(supabase: any, yearCE: number, month: number) {
  const prefix = `${yearCE}-${String(month).padStart(2, '0')}`;
  const { data, error } = await supabase.from('leave_records').select('*').gte('date_key', `${prefix}-01`).lte('date_key', `${prefix}-31`);
  if (error) throw new ApiError(error.message, 500);
  const rows = data ?? [];
  const byPerson = new Map<string, { code: string; name: string; leave: number; official: number; total: number; dates: { dateText: string; type: string }[] }>();
  for (const r of rows) {
    const cur = byPerson.get(r.code) ?? { code: r.code, name: r.name, leave: 0, official: 0, total: 0, dates: [] };
    if (r.type === 'leave') cur.leave++; else cur.official++;
    cur.total++;
    cur.dates.push({ dateText: formatThaiCompactLocal(r.date_key), type: r.type === 'official' ? 'ไปราชการ' : 'ลาราชการ' });
    byPerson.set(r.code, cur);
  }
  const people = Array.from(byPerson.values()).sort((a, b) => b.total - a.total);
  return {
    monthName: monthNameLocal(month), yearBE: toBuddhistYear(yearCE),
    totalLeave: rows.filter((r: any) => r.type === 'leave').length,
    totalOfficial: rows.filter((r: any) => r.type === 'official').length,
    people
  };
}

function formatThaiCompactLocal(dateKeyStr: string): string {
  const d = new Date(dateKeyStr + 'T12:00:00');
  const abbr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const be = String(toBuddhistYear(d.getFullYear()));
  return `${d.getDate()} ${abbr[d.getMonth()]}${be.substring(2)}`;
}
function monthNameLocal(month: number): string {
  const names = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return names[month - 1];
}

async function yearStatsTop5(supabase: any, yearCE: number) {
  const { data, error } = await supabase.from('leave_records').select('code,name,type').gte('date_key', `${yearCE}-01-01`).lte('date_key', `${yearCE}-12-31`);
  if (error) throw new ApiError(error.message, 500);
  const rows = data ?? [];
  const byPerson = new Map<string, { code: string; name: string; leave: number }>();
  for (const r of rows) {
    if (r.type !== 'leave') continue; // "5 อันดับผู้ลาราชการมากที่สุด" — ลาราชการ only, matches label.
    const cur = byPerson.get(r.code) ?? { code: r.code, name: r.name, leave: 0 };
    cur.leave++;
    byPerson.set(r.code, cur);
  }
  const top5 = Array.from(byPerson.values()).sort((a, b) => b.leave - a.leave).slice(0, 5);
  return { yearBE: toBuddhistYear(yearCE), totalLeave: rows.filter((r: any) => r.type === 'leave').length, top5 };
}

export async function getHomeData(supabase: any, yearBE: number | undefined, month: number | undefined, focusDate: string | undefined) {
  const today = todayInThailand();
  const yBE = yearBE || toBuddhistYear(today.getFullYear());
  const yCE = yBE - 543;
  const m = month || today.getMonth() + 1;
  const focus = focusDate ? (parseThaiDate(focusDate, yBE) ?? today) : today;

  const index = await loadIndex(supabase);
  const calendar = getLeaveCalendar(yCE, m, index);
  const absence = getAbsenceSummary(focus, index);
  const missionStats = await MissionService.getMissionStats(supabase, dateKey(focus), yBE);
  const summary = await monthSummary(supabase, yCE, m);
  const yearStats = await yearStatsTop5(supabase, yCE);

  const { data: monthMissions } = await supabase.from('missions').select('*')
    .gte('date_key', `${yCE}-${String(m).padStart(2, '0')}-01`).lte('date_key', `${yCE}-${String(m).padStart(2, '0')}-31`)
    .order('date_key');

  return {
    ok: true,
    system: {
      today: formatThaiFull(today), oddEven: oddEvenLabel(today),
      lastImportAt: null, notifyTime: '20:15',
      hasToken: !!Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
    },
    stats: { rpj1: index.rpj1.length, rpj2: index.rpj2.length },
    calendar, absence, missionStats, monthSummary: summary, yearStats,
    personnel: index.personnel, missions: (monthMissions ?? []).map(MissionService.toClientShape)
  };
}

export async function previewReport(supabase: any, dateText: string) {
  const yBE = defaultYearBEFromIndex();
  const date = dateText ? (parseThaiDate(dateText, yBE) ?? todayInThailand()) : todayInThailand();
  const index = await loadIndex(supabase);
  return {
    ok: true, dateKey: dateKey(date), dateFull: formatThaiFull(date), oddEven: oddEvenLabel(date),
    message: buildReportText(date, 'การปฏิบัติหน้าที่จราจรประจำวัน', index)
  };
}

export async function getAbsenceTable(supabase: any, dateText: string) {
  const yBE = defaultYearBEFromIndex();
  const date = dateText ? (parseThaiDate(dateText, yBE) ?? todayInThailand()) : todayInThailand();
  const index = await loadIndex(supabase);
  return { ok: true, ...getAbsenceSummary(date, index) };
}

export async function pushReportFromWeb(supabase: any, payload: any) {
  requirePin(payload);
  const yBE = defaultYearBEFromIndex();
  const date = payload.dateText ? (parseThaiDate(payload.dateText, yBE) ?? todayInThailand()) : todayInThailand();
  const index = await loadIndex(supabase);
  const messages = buildLineMessages(date, 'การปฏิบัติหน้าที่จราจรประจำวัน', index);
  await pushToGroup(messages);
  return { ok: true, dateKey: dateKey(date), message: `ส่งรายงานวันที่ ${dateKey(date)} เข้ากลุ่ม LINE เรียบร้อย` };
}

export async function validateLeaveEntry(supabase: any, payload: any) {
  const index = await loadIndex(supabase);
  return LeaveService.validateLeaveEntry(supabase, payload, index, defaultYearBEFromIndex());
}
export async function saveLeaveEntry(supabase: any, payload: any) {
  requirePin(payload);
  const index = await loadIndex(supabase);
  return LeaveService.saveLeaveEntry(supabase, payload, index, defaultYearBEFromIndex());
}
export async function updateLeaveEntry(supabase: any, payload: any) {
  requirePin(payload);
  const index = await loadIndex(supabase);
  return LeaveService.updateLeaveEntry(supabase, payload, index, defaultYearBEFromIndex());
}
export async function deleteLeaveEntry(supabase: any, payload: any) {
  requirePin(payload);
  return LeaveService.deleteLeaveEntry(supabase, payload);
}
export async function getAllLeaveData(supabase: any, yearBE: number) {
  return LeaveService.getAllLeaveData(supabase, yearBE || defaultYearBEFromIndex());
}
export async function searchLeaveRecords(supabase: any, keyword: string, dateText: string) {
  const index = await loadIndex(supabase);
  return LeaveService.searchLeaveRecords(supabase, keyword, dateText, index, defaultYearBEFromIndex());
}
export async function getPersonLeaveDetail(supabase: any, code: string, yearBE: number) {
  return LeaveService.getPersonLeaveDetail(supabase, code, yearBE || defaultYearBEFromIndex());
}

export async function saveMission(supabase: any, payload: any) {
  requirePin(payload);
  return MissionService.saveMission(supabase, payload, defaultYearBEFromIndex());
}
export async function updateMission(supabase: any, payload: any) {
  requirePin(payload);
  return MissionService.updateMission(supabase, payload, defaultYearBEFromIndex());
}
export async function deleteMission(supabase: any, payload: any) {
  requirePin(payload);
  return MissionService.deleteMission(supabase, payload);
}
export async function getMissionStats(supabase: any, dateText: string) {
  return MissionService.getMissionStats(supabase, dateText, defaultYearBEFromIndex());
}

export async function checkPin(payload: any) {
  return { ok: verifyPin(payload?.pin) };
}
