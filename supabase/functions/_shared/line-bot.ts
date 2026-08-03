// Ported from Code.gs ส่วนที่ 8 (LineBotService).

import { dateKey, parseThaiDate, todayInThailand, toBuddhistYear } from './dates.ts';
import { buildIndex } from './duty-engine.ts';
import { findOfficer } from './duty-query.ts';
import { buildLineMessages, buildReportText } from './message-builder.ts';

const LINE_API_PUSH = 'https://api.line.me/v2/bot/message/push';
const LINE_API_REPLY = 'https://api.line.me/v2/bot/message/reply';

function token(): string {
  return Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
}
function groupId(): string {
  return Deno.env.get('LINE_GROUP_ID') ?? '';
}

async function callLine(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) console.error('LINE API error', res.status, await res.text());
}

export async function push(to: string, messages: unknown[]) {
  await callLine(LINE_API_PUSH, { to, messages });
}
export async function reply(replyToken: string, messages: unknown[]) {
  await callLine(LINE_API_REPLY, { replyToken, messages: messages.slice(0, 5) });
}
export async function pushToGroup(messages: unknown[]) {
  await push(groupId(), messages);
}

function parseCommand(text: string): { action: string; keyword?: string; date?: string } {
  const t = text.trim();
  if (/help|ช่วยเหลือ|เมนู|คำสั่ง|วิธีใช้/i.test(t)) return { action: 'help' };
  if (/^id$/i.test(t)) return { action: 'id' };
  if (/สถานะ|status/i.test(t)) return { action: 'status' };
  const findMatch = t.match(/(?:ใคร|ค้นหา|เวรของ)\s*(.+)/);
  if (findMatch) return { action: 'find', keyword: findMatch[1].trim() };
  if (/พรุ่งนี้/.test(t)) return { action: 'report', date: 'tomorrow' };
  if (/เมื่อวาน/.test(t)) return { action: 'report', date: 'yesterday' };
  if (/มะรืน/.test(t)) return { action: 'report', date: 'dayaftertomorrow' };
  const dateMatch = t.match(/เวร\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/);
  if (dateMatch) return { action: 'report', date: dateMatch[1] };
  if (/เวร|ตารางเวร/.test(t)) return { action: 'report', date: 'today' };
  return { action: 'none' };
}

function resolveDate(spec: string | undefined): Date {
  const today = todayInThailand();
  if (!spec || spec === 'today') return today;
  if (spec === 'tomorrow') return new Date(today.getTime() + 86400000);
  if (spec === 'yesterday') return new Date(today.getTime() - 86400000);
  if (spec === 'dayaftertomorrow') return new Date(today.getTime() + 2 * 86400000);
  return parseThaiDate(spec, toBuddhistYear(today.getFullYear())) ?? today;
}

const HELP_TEXT = [
  '🤖 คำสั่งที่ใช้ได้',
  '- พิมพ์ "เวร" หรือ "ตารางเวร" — ดูเวรวันนี้',
  '- พิมพ์ "เวรพรุ่งนี้" / "เวรเมื่อวาน" / "เวรมะรืน"',
  '- พิมพ์ "เวร 5/8/2569" — ดูเวรวันที่ระบุ',
  '- พิมพ์ "ใคร <รหัส/ชื่อ>" หรือ "ค้นหา <คำ>" — ค้นหาเจ้าหน้าที่',
  '- พิมพ์ "สถานะ" — สถานะระบบ',
  '- พิมพ์ "id" — ดู group/user id'
].join('\n');

export async function handleEvent(event: any, supabase: any) {
  if (event.type === 'join') {
    const target = event.source?.groupId ?? event.source?.roomId ?? event.source?.userId ?? '';
    await reply(event.replyToken, [{ type: 'text', text: `สวัสดีครับ 👋\nGroup/Room/User ID: ${target}` }]);
    return;
  }
  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const cmd = parseCommand(event.message.text);
  if (cmd.action === 'none') return; // intentionally silent

  if (cmd.action === 'help') {
    await reply(event.replyToken, [{ type: 'text', text: HELP_TEXT }]);
    return;
  }
  if (cmd.action === 'id') {
    const target = event.source?.groupId ?? event.source?.roomId ?? event.source?.userId ?? '';
    await reply(event.replyToken, [{ type: 'text', text: `ID: ${target}` }]);
    return;
  }
  if (cmd.action === 'status') {
    await reply(event.replyToken, [{ type: 'text', text: '✅ ระบบทำงานปกติ' }]);
    return;
  }
  if (cmd.action === 'find') {
    const index = await buildIndex(supabase);
    const matches = findOfficer(cmd.keyword ?? '', index);
    const text = matches.length
      ? matches.slice(0, 10).map((m) => `${m.name} — ${m.point} (${m.source})`).join('\n')
      : 'ไม่พบข้อมูล';
    await reply(event.replyToken, [{ type: 'text', text }]);
    return;
  }
  if (cmd.action === 'report') {
    const date = resolveDate(cmd.date);
    const index = await buildIndex(supabase);
    const messages = buildLineMessages(date, 'การปฏิบัติหน้าที่จราจรประจำวัน', index);
    await reply(event.replyToken, messages);
    return;
  }
}

export async function handleWebhook(body: any, supabase: any) {
  const events = body?.events ?? [];
  for (const event of events) {
    try {
      await handleEvent(event, supabase);
    } catch (err) {
      console.error('handleEvent failed', err);
    }
  }
}
