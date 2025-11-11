import { supabase } from '../db/supabase.js';
import { sendPushToSubscription } from '../utils/push.js';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const PREBLOCK_WINDOW_MIN = Number(process.env.PREBLOCK_WINDOW_MIN || 10);

const remindedBlocks = new Set<string>();
const lastDailySummaryByUser = new Map<string, string>(); // user_id -> YYYY-MM-DD (in their timezone)

async function sendToUser(userId: string, payload: any) {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error || !subs || subs.length === 0) return;
  const json = JSON.stringify(payload);
  for (const s of subs) {
    await sendPushToSubscription(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      json,
    );
  }
}

async function runPreblockReminders() {
  const now = new Date();
  const soon = addMinutes(now, PREBLOCK_WINDOW_MIN);
  const { data: blocks, error } = await supabase
    .from('time_blocks')
    .select('id, user_id, task_id, start_at, end_at')
    .gte('start_at', now.toISOString())
    .lte('start_at', soon.toISOString());
  if (error || !blocks) return;
  for (const b of blocks) {
    if (remindedBlocks.has(b.id)) continue;
    remindedBlocks.add(b.id);
    await sendToUser(b.user_id, {
      type: 'preblock',
      title: '即将开始的学习时段',
      body: '你的学习时间块即将开始',
      start_at: b.start_at,
      task_id: b.task_id,
    });
  }
}

function hhmmInZone(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  const parts = fmt.formatToParts(d);
  const hh = parts.find(p => p.type === 'hour')?.value || '00';
  const mm = parts.find(p => p.type === 'minute')?.value || '00';
  return `${hh}:${mm}`;
}

function ymdInZone(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz });
  // en-CA yields YYYY-MM-DD
  return fmt.format(d);
}

async function runDailySummary() {
  const now = new Date();
  // Load users who configured daily summary time
  const { data: rows, error } = await supabase
    .from('user_settings')
    .select('user_id, daily_summary_time, timezone')
    .not('daily_summary_time', 'is', null);
  if (error || !rows || rows.length === 0) return;

  for (const r of rows as any[]) {
    const uid: string = r.user_id;
    const tz: string = r.timezone || 'Asia/Shanghai';
    const target: string = String(r.daily_summary_time).slice(0, 5); // HH:MM or HH:MM:SS
    const localNow = hhmmInZone(now, tz);
    if (localNow !== target) continue; // only fire at the configured minute

    const todayLocal = ymdInZone(now, tz);
    if (lastDailySummaryByUser.get(uid) === todayLocal) continue; // already sent today
    lastDailySummaryByUser.set(uid, todayLocal);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notifications] daily summary for user ${uid} at ${localNow} ${tz} (${todayLocal})`);
    }

    // Count open tasks due today in user's timezone, and overdue before local start
    const nowLocal = toZonedTime(now, tz);
    const startLocal = startOfDay(nowLocal);
    const endLocal = endOfDay(nowLocal);
    const startUtc = fromZonedTime(startLocal, tz);
    const endUtc = fromZonedTime(endLocal, tz);
    const [{ data: todayTasks }, { data: overdueTasks }] = await Promise.all([
      supabase.from('tasks').select('id').eq('user_id', uid).eq('status', 'open').gte('due_at', startUtc.toISOString()).lte('due_at', endUtc.toISOString()),
      supabase.from('tasks').select('id').eq('user_id', uid).eq('status', 'open').lt('due_at', startUtc.toISOString()),
    ]);
    const countToday = (todayTasks || []).length;
    const countOverdue = (overdueTasks || []).length;
    await sendToUser(uid, {
      type: 'daily_summary',
      title: '每日总结',
      body: `今天待办 ${countToday} 项，逾期 ${countOverdue} 项`,
      date: todayLocal,
    });
  }
}

export function startNotificationScheduler() {
  // Run every minute in dev
  setInterval(runPreblockReminders, 60 * 1000);
  setInterval(runDailySummary, 60 * 1000);
}
