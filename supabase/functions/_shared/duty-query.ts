// Ported from Code.gs ส่วนที่ 4 (DutyQueryService).

import {
  addDays, cleanText, dateKey, formatThaiCompact, formatThaiFull, formatThaiShort,
  isOddDay, oddEvenLabel, parseThaiDate, TH_WEEKDAY, toBuddhistYear
} from './dates.ts';
import type { AnnotatedEntry, DutyIndex, RpjMember } from './duty-engine.ts';

export type Shift = 'morning' | 'afternoon';

// Rotation rule (Code.gs getDutyForDate): odd day -> rpj1=morning/rpj2=afternoon; even day -> reversed.
export function rosterFor(index: DutyIndex, date: Date, shift: Shift): RpjMember[] {
  const odd = isOddDay(date);
  const morningIsRpj1 = odd;
  if (shift === 'morning') return morningIsRpj1 ? index.rpj1 : index.rpj2;
  return morningIsRpj1 ? index.rpj2 : index.rpj1;
}

export function sourceNameFor(date: Date, shift: Shift): string {
  const odd = isOddDay(date);
  const morningIsRpj1 = odd;
  if (shift === 'morning') return morningIsRpj1 ? 'รปจ.1' : 'รปจ.2';
  return morningIsRpj1 ? 'รปจ.2' : 'รปจ.1';
}

function resolveStatus(
  code: string, key: string, restKeys: string[],
  leaveByDate: Record<string, { code: string }[]>, officialByDate: Record<string, { code: string }[]>
): 'leave' | 'official' | 'rest' | 'duty' {
  if ((leaveByDate[key] ?? []).some((r) => r.code === code)) return 'leave';
  if ((officialByDate[key] ?? []).some((r) => r.code === code)) return 'official';
  if (restKeys.includes(key)) return 'rest';
  return 'duty';
}

const STATUS_LABEL: Record<string, string> = { leave: 'ลาราชการ', official: 'ไปราชการ', rest: 'เวรพัก', duty: '' };

function splitShift(members: RpjMember[], key: string, index: DutyIndex, sourceName: string) {
  const onDuty: AnnotatedEntry[] = [];
  const rest: AnnotatedEntry[] = [];
  const leave: AnnotatedEntry[] = [];
  const official: AnnotatedEntry[] = [];
  for (const m of members) {
    const status = resolveStatus(m.code, key, m.restKeys, index.leave, index.official);
    const entry: AnnotatedEntry = {
      code: m.code, name: m.name, point: m.point, section: sourceName,
      status, statusLabel: STATUS_LABEL[status], absent: status !== 'duty'
    };
    if (status === 'duty') onDuty.push(entry);
    else if (status === 'rest') rest.push(entry);
    else if (status === 'leave') leave.push(entry);
    else official.push(entry);
  }
  return { onDuty, rest, leave, official, sourceName };
}

function annotate(members: { code: string; name: string; point?: string }[], key: string, index: DutyIndex, section: string, restKeysOf?: (code: string) => string[]): AnnotatedEntry[] {
  return members.map((m) => {
    const restKeys = restKeysOf ? restKeysOf(m.code) : [];
    const status = resolveStatus(m.code, key, restKeys, index.leave, index.official);
    return { code: m.code, name: m.name, point: m.point ?? '', section, status, statusLabel: STATUS_LABEL[status], absent: status !== 'duty' };
  });
}

export function matchesWeekdaySchedule(scheduleText: string, date: Date): boolean {
  const s = cleanText(scheduleText);
  if (!s) return false;
  if (/ทุกวัน/.test(s)) return true;
  const exact = parseThaiDate(s, toBuddhistYear(date.getFullYear()));
  if (exact) return dateKey(exact) === dateKey(date);
  const names = TH_WEEKDAY.map((w) => w.replace('วัน', ''));
  const found: { idx: number; pos: number }[] = [];
  for (let i = 0; i < names.length; i++) {
    const pos = s.indexOf(names[i]);
    if (pos >= 0) found.push({ idx: i, pos });
  }
  if (found.length === 0) return false;
  const today = date.getDay();
  if (found.length === 1) return found[0].idx === today;
  found.sort((a, b) => a.pos - b.pos);
  const start = found[0].idx;
  const end = found[found.length - 1].idx;
  if (/[-–ถึง]/.test(s)) {
    if (start <= end) return today >= start && today <= end;
    return today >= start || today <= end;
  }
  return found.some((f) => f.idx === today);
}

// จุดเร่งด่วน/วิทยุ/พลขับ are never cut from their list, but always get a
// status label — so their rest-status has to come from whichever rpj1/rpj2
// row that code actually belongs to (own restKeys), not a per-list one.
function restKeysForCode(code: string, index: DutyIndex): string[] {
  const m = [...index.rpj1, ...index.rpj2].find((x) => x.code === code);
  return m?.restKeys ?? [];
}

export function getDutyForDate(date: Date, index: DutyIndex) {
  const key = dateKey(date);
  const odd = isOddDay(date);
  const morningSource = sourceNameFor(date, 'morning');
  const afternoonSource = sourceNameFor(date, 'afternoon');

  const morning = splitShift(rosterFor(index, date, 'morning'), key, index, morningSource);
  const afternoon = splitShift(rosterFor(index, date, 'afternoon'), key, index, afternoonSource);

  const rushMorningList = odd ? index.rush.amOdd : index.rush.amEven;
  const rushAfternoonList = odd ? index.rush.pmOdd : index.rush.pmEven;
  const rush = {
    morning: annotate(rushMorningList, key, index, `จุดเร่งด่วน (ผลัดเช้า)`, (code) => restKeysForCode(code, index)),
    afternoon: annotate(rushAfternoonList, key, index, `จุดเร่งด่วน (ผลัดบ่าย)`, (code) => restKeysForCode(code, index))
  };

  const radio = annotate(index.radio[key] ?? [], key, index, 'วิทยุ', (code) => restKeysForCode(code, index));
  const drivers = annotate(
    index.driver.filter((d) => matchesWeekdaySchedule(d.scheduleText, date)).map((d) => ({ code: d.code, name: d.name })),
    key, index, 'พลขับ', (code) => restKeysForCode(code, index)
  );

  const absent = [...rush.morning, ...rush.afternoon, ...radio, ...drivers].filter((e) => e.absent);

  return {
    date, dateKey: key, dateFull: formatThaiFull(date), dateShort: formatThaiShort(date),
    oddEven: oddEvenLabel(date), isOdd: odd,
    morningSource, afternoonSource,
    special: index.missions[key] ?? [], dutyOfficer: index.dutyOfficer[key] ?? null,
    morning, afternoon, rush, radio, drivers, absent,
    fine: index.fine[key] ?? null, night: index.night[key] ?? [], yearBE: toBuddhistYear(date.getFullYear())
  };
}

export function getAbsenceSummary(date: Date, index: DutyIndex) {
  const duty = getDutyForDate(date, index);
  const rows: any[] = [];
  for (const e of [...duty.morning.rest, ...duty.morning.leave, ...duty.morning.official]) {
    rows.push({ name: e.name, section: 'ชุดปฏิบัติการจราจร (ผลัดเช้า)', code: e.code, point: e.point, statusLabel: e.statusLabel, status: e.status });
  }
  for (const e of [...duty.afternoon.rest, ...duty.afternoon.leave, ...duty.afternoon.official]) {
    rows.push({ name: e.name, section: 'ชุดปฏิบัติการจราจร (ผลัดบ่าย)', code: e.code, point: e.point, statusLabel: e.statusLabel, status: e.status });
  }
  return {
    dateFull: duty.dateFull, dateShort: duty.dateShort, oddEven: duty.oddEven,
    totalPoints: index.rpj1.length + index.rpj2.length,
    absentCount: rows.length, rows, drivers: []
  };
}

export function getLeaveCalendar(yearCE: number, month: number, index: DutyIndex) {
  const first = new Date(yearCE, month - 1, 1, 12);
  const daysInMonth = new Date(yearCE, month, 0).getDate();
  const days: Record<string, any> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(yearCE, month - 1, d, 12);
    const key = dateKey(date);
    days[key] = {
      rest: [...index.rpj1, ...index.rpj2].filter((m) => m.restKeys.includes(key))
        .map((m) => ({ name: m.name, code: m.code, source: m.source, point: m.point })),
      official: index.official[key] ?? [],
      holiday: index.holiday[key] ?? '',
      leave: index.leave[key] ?? []
    };
  }
  return {
    firstWeekday: first.getDay(), todayKey: dateKey(new Date()), daysInMonth,
    month, yearBE: toBuddhistYear(yearCE), monthName: monthNameThai(month), yearCE, days
  };
}

export function monthNameThai(month: number): string {
  const names = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return names[month - 1];
}

export function findOfficer(keyword: string, index: DutyIndex) {
  const kw = cleanText(keyword);
  if (!kw) return [];
  const pool = [...index.rpj1, ...index.rpj2];
  const exact = pool.filter((m) => m.code === kw);
  if (exact.length) return exact;
  return pool.filter((m) => m.code.includes(kw) || m.name.includes(kw));
}

// shiftOf: which shift (morning/afternoon) a person works on a given date,
// based on whether their code belongs to rpj1 or rpj2. null = "ไม่ทราบผลัด".
export function shiftOf(code: string, date: Date, index: DutyIndex): Shift | null {
  const inRpj1 = index.rpj1.some((m) => m.code === code);
  const inRpj2 = index.rpj2.some((m) => m.code === code);
  if (!inRpj1 && !inRpj2) return null;
  const odd = isOddDay(date);
  if (inRpj1) return odd ? 'morning' : 'afternoon';
  return odd ? 'afternoon' : 'morning';
}

export function holidayInfo(date: Date, index: DutyIndex): string | null {
  const key = dateKey(date);
  if (index.holiday[key]) return index.holiday[key];
  const dow = date.getDay();
  if (dow === 0) return 'วันอาทิตย์';
  if (dow === 6) return 'วันเสาร์';
  return null;
}

export function isOwnRestDay(code: string, date: Date, index: DutyIndex): boolean {
  const key = dateKey(date);
  const m = [...index.rpj1, ...index.rpj2].find((x) => x.code === code);
  return !!m && m.restKeys.includes(key);
}

export { addDays };
