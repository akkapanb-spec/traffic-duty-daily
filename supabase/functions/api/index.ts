// IMPORTANT: deploy with `supabase functions deploy api --no-verify-jwt` —
// this must be reachable with no Authorization header at all (matching the
// original GAS deployment's "Anyone" access); write actions are protected by
// the ADMIN_PIN check inside web-api.ts instead, not by Supabase JWT auth.
//
// Single router Edge Function replacing every google.script.run.fn(...args)
// call in Index.html. POST { action: 'getHomeData', args: [yearBE, month, focusDate] }.
// `args` mirrors the exact positional arguments the original GAS functions
// were called with (see site/index.html's google.script.run shim) — some
// take a single payload object, some take several positional values.

import { getServiceClient, ApiError } from '../_shared/db.ts';
import * as WebApi from '../_shared/web-api.ts';
import { importExcelFile } from '../_shared/import-excel.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: 'invalid JSON body' }, 400);
  }

  const { action, args = [] } = body ?? {};
  const supabase = getServiceClient();

  try {
    switch (action) {
      case 'getHomeData':
        return json(await WebApi.getHomeData(supabase, Number(args[0]) || undefined, Number(args[1]) || undefined, args[2]));
      case 'previewReport':
        return json(await WebApi.previewReport(supabase, args[0]));
      case 'getAbsenceTable':
        return json(await WebApi.getAbsenceTable(supabase, args[0]));
      case 'pushReportFromWeb':
        return json(await WebApi.pushReportFromWeb(supabase, args[0]));
      case 'validateLeaveEntry':
        return json(await WebApi.validateLeaveEntry(supabase, args[0]));
      case 'saveLeaveEntry':
        return json(await WebApi.saveLeaveEntry(supabase, args[0]));
      case 'updateLeaveEntry':
        return json(await WebApi.updateLeaveEntry(supabase, args[0]));
      case 'deleteLeaveEntry':
        return json(await WebApi.deleteLeaveEntry(supabase, args[0]));
      case 'getAllLeaveData':
        return json(await WebApi.getAllLeaveData(supabase, Number(args[0])));
      case 'searchLeaveRecords':
        return json(await WebApi.searchLeaveRecords(supabase, args[0], args[1]));
      case 'getPersonLeaveDetail':
        return json(await WebApi.getPersonLeaveDetail(supabase, args[0], Number(args[1])));
      case 'saveMission':
        return json(await WebApi.saveMission(supabase, args[0]));
      case 'updateMission':
        return json(await WebApi.updateMission(supabase, args[0]));
      case 'deleteMission':
        return json(await WebApi.deleteMission(supabase, args[0]));
      case 'getMissionStats':
        return json(await WebApi.getMissionStats(supabase, args[0]));
      case 'importExcelFile':
        return json(await importExcelFile(supabase, args[0]));
      case 'checkPin':
        return json(await WebApi.checkPin(args[0]));
      default:
        return json({ ok: false, message: `unknown action: ${action}` }, 400);
    }
  } catch (err) {
    if (err instanceof ApiError) return json({ ok: false, message: err.message }, err.status);
    console.error('api error', err);
    return json({ ok: false, message: String((err as Error)?.message ?? err) }, 500);
  }
});
