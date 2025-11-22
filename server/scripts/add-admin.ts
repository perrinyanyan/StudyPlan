import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: user } = await supabase.from('users').select('id').eq('email', 'pemo_ho@163.com').single();
  if (!user) { console.log('User not found'); return; }
  const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'system_admin', scope_type: 'system', scope_id: null });
  if (error \u0026\u0026 error.code !== '23505') console.error(error);
  else console.log('✅ Added system_admin role');
})();
