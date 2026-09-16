import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function notifyTaskClient(db: SupabaseClient, accountId: string, phone: string, message: string) {
  try {
    const { data: config } = await db.from('whatsapp_config').select('phone_number_id, access_token').eq('account_id', accountId).maybeSingle();
    if (!config) return { sent: false, reason: 'not_configured' };
    const result = await sendTextMessage({ phoneNumberId: config.phone_number_id, accessToken: decrypt(config.access_token), to: phone, text: message });
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.warn('[task notification] WhatsApp notification failed:', error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
}