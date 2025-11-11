import { supabase } from '../db/supabase.js';
import { sendPushToSubscription } from '../utils/push.js';
import { addMinutes } from 'date-fns';

const PREBLOCK_WINDOW_MIN = Number(process.env.PREBLOCK_WINDOW_MIN || 10);

const remindedBlocks = new Set<string>();
let lastDailySummaryDate = '';

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

async function runDailySummary() {
  // Use UTC date string for once-per-day guard
  const today = new Date().toISOString().slice(0, 10);
  if (lastDailySummaryDate === today) return;
  const now = new Date();
  const hhmm = now.toISOString().slice(11, 16); // UTC HH:MM
  const target = process.env.DAILY_SUMMARY_UTC_HHMM || '20:00';
  if (hhmm !== target) return;
  lastDailySummaryDate = today;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[notifications] daily summary triggered for ${today} at ${hhmm} (target ${target})`);
  }

  // Fetch users who have subscriptions
  const { data: users, error } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .neq('user_id', null);
  if (error || !users) return;
  const uniq = Array.from(new Set(users.map(u => u.user_id)));

  for (const uid of uniq) {
    // Count open tasks due today or overdue
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    const [{ data: todayTasks }, { data: overdueTasks }] = await Promise.all([
      supabase.from('tasks').select('id').eq('user_id', uid).eq('status', 'open').gte('due_at', start.toISOString()).lte('due_at', end.toISOString()),
      supabase.from('tasks').select('id').eq('user_id', uid).eq('status', 'open').lt('due_at', start.toISOString()),
    ]);
    const countToday = (todayTasks || []).length;
    const countOverdue = (overdueTasks || []).length;
    await sendToUser(uid, {
      type: 'daily_summary',
      title: '每日总结',
      body: `今天待办 ${countToday} 项，逾期 ${countOverdue} 项`,
      date: today,
    });
  }
}

export function startNotificationScheduler() {
  // Run every minute in dev
  setInterval(runPreblockReminders, 60 * 1000);
  setInterval(runDailySummary, 60 * 1000);
}
