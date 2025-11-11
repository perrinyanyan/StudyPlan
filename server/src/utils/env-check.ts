export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const errs: string[] = [];

  const jwt = process.env.JWT_SECRET || '';
  if (!jwt || jwt === 'changeme') errs.push('JWT_SECRET');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) errs.push('SUPABASE_URL');
  if (!serviceKey) errs.push('SUPABASE_SERVICE_ROLE_KEY');

  const vapidPub = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPriv = process.env.VAPID_PRIVATE_KEY || '';
  const vapidSub = process.env.VAPID_SUBJECT || '';
  if (!vapidPub || !vapidPriv || !vapidSub) {
    if (isProd) errs.push('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT');
  }

  if (errs.length > 0) {
    const msg = `[env] Missing or invalid: ${errs.join(', ')}`;
    if (isProd) throw new Error(msg);
    else console.warn(msg);
  }
}
