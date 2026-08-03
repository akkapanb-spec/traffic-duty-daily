// Ported from Code.gs ส่วนที่ 3 (DutyEngine) — reads every table instead of
// every sheet, and returns the same shaped in-memory "index" the rest of the
// business logic (duty-query, message-builder, leave-service) expects.

import { addDays, cleanText, dateKey, extractCode, isBlankValue } from './dates.ts';

export interface RpjMember {
  seq: number | null;
  code: string;
  name: string;
  point: string;
  restKeys: string[];
  source: string;
}
export interface AnnotatedEntry {
  code: string;
  name: string;
  point: string;
  section: string;
  status: 'duty' | 'rest' | 'leave' | 'official';
  statusLabel: string;
  absent: boolean;
}
export interface Mission {
  id: string;
  groupId: string;
  dateKey: string;
  type: string | null;
  detail: string | null;
  contact: string | null;
  phone: string | null;
  owner: string | null;
  image1: string | null;
  image2: string | null;
  time: string | null;
  place: string | null;
  createdAt: string;
}
export interface PersonnelMember {
  code: string;
  name: string;
  source: string;
  point: string;
  position: string;
}

export interface DutyIndex {
  rpj1: RpjMember[];
  rpj2: RpjMember[];
  rush: { amOdd: RpjMember[]; pmOdd: RpjMember[]; amEven: RpjMember[]; pmEven: RpjMember[] };
  radio: Record<string, { code: string; name: string }[]>;
  driver: { scheduleText: string; code: string; name: string }[];
  fine: Record<string, { shiftA: string | null; shiftB: string | null }>;
  night: Record<string, string[]>;
  dutyOfficer: Record<string, { d60: string | null; d600: string | null }>;
  roster: { code: string; name: string; position: string }[];
  restPeriods: { code: string; name: string; point: string; rangeText: string; keys: string[] }[];
  leave: Record<string, { code: string; name: string; point: string }[]>;
  official: Record<string, { code: string; name: string; point: string }[]>;
  holiday: Record<string, string>;
  missions: Record<string, Mission[]>;
  personnel: PersonnelMember[];
}

function toRpjMember(row: any, source: string): RpjMember {
  return {
    seq: row.seq,
    code: row.code,
    name: row.name,
    point: row.point ?? '',
    restKeys: row.rest_dates ?? [],
    source
  };
}

export async function buildIndex(supabase: any): Promise<DutyIndex> {
  const [
    rpj1Res, rpj2Res, rushRes, radioRes, driverRes, fineRes, nightRes,
    dutyOfficerRes, rosterRes, restRes, leaveRes, holidayRes, missionsRes
  ] = await Promise.all([
    supabase.from('officers_rpj1').select('*').order('seq'),
    supabase.from('officers_rpj2').select('*').order('seq'),
    supabase.from('rush_points').select('*').order('seq'),
    supabase.from('radio_duty').select('*'),
    supabase.from('driver_duty').select('*'),
    supabase.from('fine_duty').select('*'),
    supabase.from('night_duty').select('*'),
    supabase.from('duty_officer').select('*'),
    supabase.from('roster').select('*'),
    supabase.from('rest_periods').select('*'),
    supabase.from('leave_records').select('*'),
    supabase.from('holidays').select('*'),
    supabase.from('missions').select('*').order('date_key')
  ]);

  for (const r of [rpj1Res, rpj2Res, rushRes, radioRes, driverRes, fineRes, nightRes, dutyOfficerRes, rosterRes, restRes, leaveRes, holidayRes, missionsRes]) {
    if (r.error) throw new Error(`DB read failed: ${r.error.message}`);
  }

  const rpj1 = (rpj1Res.data ?? []).map((r: any) => toRpjMember(r, 'รปจ.1'));
  const rpj2 = (rpj2Res.data ?? []).map((r: any) => toRpjMember(r, 'รปจ.2'));

  const rush = { amOdd: [] as RpjMember[], pmOdd: [] as RpjMember[], amEven: [] as RpjMember[], pmEven: [] as RpjMember[] };
  for (const row of rushRes.data ?? []) {
    const m = toRpjMember(row, `เร่งด่วน${row.shift === 'am' ? 'เช้า' : 'บ่าย'}(${row.day_type === 'odd' ? 'วันคี่' : 'วันคู่'})`);
    const key = `${row.shift}${row.day_type === 'odd' ? 'Odd' : 'Even'}` as keyof typeof rush;
    rush[key].push(m);
  }

  const radio: DutyIndex['radio'] = {};
  for (const row of radioRes.data ?? []) {
    (radio[row.date_key] ??= []).push({ code: row.code ?? '', name: row.name });
  }

  const driver = (driverRes.data ?? []).map((r: any) => ({ scheduleText: r.schedule_text ?? '', code: r.code ?? '', name: r.name }));

  const fine: DutyIndex['fine'] = {};
  for (const row of fineRes.data ?? []) fine[row.date_key] = { shiftA: row.shift_a_text, shiftB: row.shift_b_text };

  const night: DutyIndex['night'] = {};
  for (const row of nightRes.data ?? []) {
    night[row.date_key] = [row.name1, row.name2].filter((n: string | null) => n && !isBlankValue(n)) as string[];
  }

  const dutyOfficer: DutyIndex['dutyOfficer'] = {};
  for (const row of dutyOfficerRes.data ?? []) dutyOfficer[row.date_key] = { d60: row.d60, d600: row.d600 };

  const roster = (rosterRes.data ?? []).map((r: any) => ({ code: r.code, name: r.name, position: r.position ?? '' }));

  const restPeriods = (restRes.data ?? []).map((r: any) => {
    const keys: string[] = [];
    if (r.start_date && r.end_date) {
      let cursor = new Date(r.start_date + 'T12:00:00');
      const end = new Date(r.end_date + 'T12:00:00');
      let guard = 0;
      while (dateKey(cursor) <= dateKey(end) && guard < 40) {
        keys.push(dateKey(cursor));
        cursor = addDays(cursor, 1);
        guard++;
      }
    }
    return { code: r.code, name: r.name, point: r.point ?? '', rangeText: r.range_text ?? '', keys };
  });

  const leave: DutyIndex['leave'] = {};
  const official: DutyIndex['official'] = {};
  for (const row of leaveRes.data ?? []) {
    const target = row.type === 'official' ? official : leave;
    (target[row.date_key] ??= []).push({ code: row.code, name: row.name, point: row.point ?? '' });
  }

  const holiday: DutyIndex['holiday'] = {};
  for (const row of holidayRes.data ?? []) holiday[row.date_key] = row.name;

  const missions: DutyIndex['missions'] = {};
  for (const row of missionsRes.data ?? []) {
    (missions[row.date_key] ??= []).push({
      id: row.id, groupId: row.group_id, dateKey: row.date_key, type: row.type, detail: row.detail,
      contact: row.contact, phone: row.phone, owner: row.owner, image1: row.image1_url, image2: row.image2_url,
      time: row.time_text, place: row.place, createdAt: row.created_at
    });
  }

  const personnel = buildPersonnel({ rpj1, rpj2, roster, dutyOfficer, radio, fine, driver, night });

  return { rpj1, rpj2, rush, radio, driver, fine, night, dutyOfficer, roster, restPeriods, leave, official, holiday, missions, personnel };
}

function buildPersonnel(parts: {
  rpj1: RpjMember[]; rpj2: RpjMember[]; roster: { code: string; name: string; position: string }[];
  dutyOfficer: DutyIndex['dutyOfficer']; radio: DutyIndex['radio']; fine: DutyIndex['fine'];
  driver: { scheduleText: string; code: string; name: string }[]; night: DutyIndex['night'];
}): PersonnelMember[] {
  const byCode = new Map<string, PersonnelMember>();
  const add = (raw: string | null | undefined, source: string, point = '', position = '') => {
    if (!raw || isBlankValue(raw)) return;
    const code = extractCode(raw);
    if (!code || byCode.has(code)) return;
    byCode.set(code, { code, name: cleanText(raw), source, point, position });
  };

  for (const m of parts.rpj1) add(m.name, m.source, m.point);
  for (const m of parts.rpj2) add(m.name, m.source, m.point);
  for (const r of parts.roster) add(r.name, 'รายชื่ออจราจร', '', r.position);
  for (const v of Object.values(parts.dutyOfficer)) { add(v.d60, 'ร้อยเวรจราจร'); add(v.d600, 'ร้อยเวรจราจร'); }
  for (const rows of Object.values(parts.radio)) for (const r of rows) add(r.name, 'วิทยุ');
  for (const v of Object.values(parts.fine)) { add(v.shiftA, 'เทียบปรับ'); add(v.shiftB, 'เทียบปรับ'); }
  for (const d of parts.driver) add(d.name, 'พลขับ');
  for (const names of Object.values(parts.night)) for (const n of names) add(n, 'เวรนอน');

  return Array.from(byCode.values());
}
