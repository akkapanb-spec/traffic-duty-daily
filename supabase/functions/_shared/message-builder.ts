// Ported from Code.gs ส่วนที่ 5 (MessageBuilder) — text mode only (flex mode
// dropped in v1; the manual's MESSAGE_MODE default is 'text' anyway).

import { cleanText, isBlankValue } from './dates.ts';
import type { AnnotatedEntry, DutyIndex } from './duty-engine.ts';
import { getDutyForDate } from './duty-query.ts';

const EMPTY_TEXT = '- ไม่มีข้อมูล';
const POINT_SEPARATOR = '➜';
const DIVIDER_LINE = '              ◇  ◇  ◇  ◇  ◇  ◇  ◇  ◇';

function personLine(bullet: string, name: string, point?: string | null): string {
  let line = `${bullet} ${cleanText(name)}`;
  const p = cleanText(point ?? '');
  if (p && !isBlankValue(p)) line += ` ${POINT_SEPARATOR} ${p}`;
  return line;
}

function personBlock(items: { name: string; point?: string | null }[], bullet: string, emptyText = EMPTY_TEXT): string {
  if (!items || items.length === 0) return emptyText;
  return items.map((it) => personLine(bullet, it.name, it.point)).join('\n');
}

function statusBlock(items: AnnotatedEntry[], bullet: string, hidePoint = false): string {
  if (!items || items.length === 0) return EMPTY_TEXT;
  return items.map((it) => {
    let line = personLine(bullet, it.name, hidePoint ? undefined : it.point);
    if (it.statusLabel) line += `  ${it.status === 'rest' ? '💤' : it.status === 'leave' ? '🚫' : '🚗'} ${it.statusLabel}`;
    return line;
  }).join('\n');
}

export function buildReportText(date: Date, title: string, index: DutyIndex): string {
  const duty = getDutyForDate(date, index);
  const lines: string[] = [];

  lines.push(`🚦 ${title}`);
  lines.push(`📅 ${duty.dateFull}`);
  lines.push('');
  lines.push(`📌 ภารกิจพิเศษประจำวัน (${duty.dateShort})`);
  lines.push(duty.special.length
    ? duty.special.map((m) => `- ${m.type ?? ''}: ${m.detail ?? ''}${m.place ? ' @ ' + m.place : ''}`).join('\n')
    : '- ไม่มีข้อมูล');
  lines.push('');

  lines.push('🚔 ร้อยเวรจราจร');
  if (duty.dutyOfficer) {
    lines.push('ร้อยเวร 60');
    lines.push(`• ${cleanText(duty.dutyOfficer.d60 ?? '')}`);
    lines.push('ร้อยเวร 600');
    lines.push(`• ${cleanText(duty.dutyOfficer.d600 ?? '')}`);
  } else {
    lines.push(EMPTY_TEXT);
  }
  lines.push('');

  lines.push('👮 ชุดปฏิบัติการจราจร (ผลัดเช้า)');
  lines.push(personBlock(duty.morning.onDuty, '•'));
  lines.push('');
  lines.push('👮 ชุดปฏิบัติการจราจร (ผลัดบ่าย)');
  lines.push(personBlock(duty.afternoon.onDuty, '•'));
  lines.push('');

  lines.push('⏱️ จุดเร่งด่วน (ผลัดเช้า)');
  lines.push(statusBlock(duty.rush.morning, '•'));
  lines.push('');
  lines.push('⏱️ จุดเร่งด่วน (ผลัดบ่าย)');
  lines.push(statusBlock(duty.rush.afternoon, '•'));
  lines.push('');

  lines.push('📻 วิทยุ');
  lines.push(statusBlock(duty.radio, '-'));
  lines.push('');
  lines.push('🚓 พลขับ');
  lines.push(statusBlock(duty.drivers, '-'));
  lines.push('');

  lines.push('🧾 เปรียบเทียบปรับ');
  if (duty.fine) {
    lines.push(`- ปฏิบัติหน้าที่เวลา 08.00-16.00 น.: ${cleanText(duty.fine.shiftA ?? '') || '-'}`);
    lines.push(`- ปฏิบัติหน้าที่เวลา 10.00-20.00 น.: ${cleanText(duty.fine.shiftB ?? '') || '-'}`);
  } else {
    lines.push(EMPTY_TEXT);
  }
  lines.push('');

  lines.push('🌙 เวรรับเหตุกลางคืน');
  lines.push(duty.night.length ? duty.night.map((n) => `- ${cleanText(n)}`).join('\n') : EMPTY_TEXT);
  lines.push('');

  lines.push('☀️ เวรพัก (ผลัดเช้า)');
  lines.push(personBlock(duty.morning.rest, '•'));
  lines.push('🌙 เวรพัก (ผลัดบ่าย)');
  lines.push(personBlock(duty.afternoon.rest, '•'));
  lines.push('');

  lines.push('📄 ลาราชการ (ผลัดเช้า)');
  lines.push(personBlock(duty.morning.leave, '•'));
  lines.push('📄 ลาราชการ (ผลัดบ่าย)');
  lines.push(personBlock(duty.afternoon.leave, '•'));
  lines.push('');

  lines.push('🚗 ไปราชการ (ผลัดเช้า)');
  lines.push(personBlock(duty.morning.official, '•'));
  lines.push('🚗 ไปราชการ (ผลัดบ่าย)');
  lines.push(personBlock(duty.afternoon.official, '•'));
  lines.push('');

  lines.push('⚠️ สรุปจุดเร่งด่วน/วิทยุ/พลขับ ที่ไม่มีผู้ปฏิบัติ');
  if (duty.absent.length === 0) {
    lines.push('- ไม่มี');
  } else {
    for (const e of duty.absent) {
      lines.push(`• [${e.statusLabel}] ${e.section}`);
      lines.push(`   ${cleanText(e.name)} ${POINT_SEPARATOR} ${e.point}`);
    }
    lines.push(`รวม ${duty.absent.length} จุดที่ต้องจัดกำลังทดแทน`);
  }
  lines.push(DIVIDER_LINE);

  return lines.join('\n');
}

function splitMessage(text: string, limit = 4800): string[] {
  if (text.length <= limit) return [text];
  const lines = text.split('\n');
  const chunks: string[] = [];
  let buffer = '';
  for (const line of lines) {
    if ((buffer + '\n' + line).length > limit) {
      chunks.push(buffer);
      buffer = line;
    } else {
      buffer = buffer ? buffer + '\n' + line : line;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export function buildLineMessages(date: Date, title: string, index: DutyIndex): { type: 'text'; text: string }[] {
  const text = buildReportText(date, title, index);
  return splitMessage(text).map((t) => ({ type: 'text' as const, text: t }));
}
