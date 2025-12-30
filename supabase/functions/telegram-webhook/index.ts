import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const update = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update, null, 2));

    // Handle chat_member updates (when someone joins/leaves)
    if (update.chat_member) {
      const chatMember = update.chat_member;
      const newStatus = chatMember.new_chat_member?.status;
      const oldStatus = chatMember.old_chat_member?.status;
      const user = chatMember.new_chat_member?.user || chatMember.from;
      const chatId = chatMember.chat?.id?.toString();
      const inviteLink = chatMember.invite_link?.invite_link;

      console.log(`Member status change: ${oldStatus} -> ${newStatus} for user ${user?.id} in chat ${chatId}`);
      console.log(`Invite link used: ${inviteLink}`);

      // Check if user left or was kicked (member -> left/kicked)
      const wasActiveMember = ['member', 'administrator', 'creator', 'restricted'].includes(oldStatus);
      const hasLeft = ['left', 'kicked', 'banned'].includes(newStatus);

      if (wasActiveMember && hasLeft) {
        console.log(`User ${user?.id} left/removed from chat ${chatId}`);

        // Find the invite link in our database
        let linkRecord = null;

        // First try to find by the exact invite link used
        if (inviteLink) {
          const { data } = await supabase
            .from('invite_links')
            .select('*')
            .eq('invite_link', inviteLink)
            .eq('status', 'active')
            .maybeSingle();
          
          linkRecord = data;
        }

        // If not found by invite link, try to find by group_id and status = used
        // (The link might have been marked as used when they joined)
        if (!linkRecord && chatId) {
          const { data } = await supabase
            .from('invite_links')
            .select('*')
            .eq('group_id', chatId)
            .eq('status', 'used')
            .order('used_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // Only use this if it was recently used (within last hour)
          if (data?.used_at) {
            const usedAt = new Date(data.used_at);
            const now = new Date();
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            if (usedAt > hourAgo) {
              linkRecord = data;
            }
          }
        }

        if (linkRecord) {
          console.log(`Found link record: ${linkRecord.access_code}`);

          // Get bot token from settings
          const { data: tokenSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'bot_token')
            .single();

          if (tokenSetting?.value) {
            // Revoke the link on Telegram
            const revokeUrl = `https://api.telegram.org/bot${tokenSetting.value}/revokeChatInviteLink`;
            const revokeResponse = await fetch(revokeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                invite_link: linkRecord.invite_link,
              }),
            });

            const revokeResult = await revokeResponse.json();
            console.log('Revoke result:', JSON.stringify(revokeResult));

            // Update status in database - use 'closed_by_telegram' so user can still access panel
            await supabase
              .from('invite_links')
              .update({ status: 'closed_by_telegram' })
              .eq('id', linkRecord.id);

            // Log the activity
            await supabase.from('activity_logs').insert({
              action: 'auto_revoke_on_leave',
              entity_type: 'invite_link',
              entity_id: linkRecord.id,
              details: {
                access_code: linkRecord.access_code,
                user_id: user?.id,
                username: user?.username,
                reason: 'User left group',
                telegram_revoked: revokeResult.ok,
              },
              performed_by: 'telegram-webhook',
            });

            console.log(`Link ${linkRecord.access_code} revoked automatically`);
          }
        } else {
          console.log('No matching link record found for this user');
        }
      }

      // Also handle when member uses a link to join (mark as used)
      if (newStatus === 'member' && inviteLink) {
        console.log(`User ${user?.id} joined using invite link: ${inviteLink}`);
        
        // Find the link record to get access_code
        const { data: joinedLink } = await supabase
          .from('invite_links')
          .select('*')
          .eq('invite_link', inviteLink)
          .maybeSingle();

        if (joinedLink) {
          // Update link status to used
          await supabase
            .from('invite_links')
            .update({ 
              status: 'used',
              used_at: new Date().toISOString(),
            })
            .eq('id', joinedLink.id);

          // Log the join event
          await supabase.from('activity_logs').insert({
            action: 'member_joined',
            entity_type: 'invite_link',
            entity_id: joinedLink.id,
            details: {
              access_code: joinedLink.access_code,
              group_id: chatId,
              group_name: chatMember.chat?.title,
              user_id: user?.id,
              username: user?.username,
              first_name: user?.first_name,
            },
            performed_by: 'telegram-webhook',
          });

          console.log('Link marked as used and join logged');
        }
      }

      // Log when member leaves (even if no link found)
      if (wasActiveMember && hasLeft) {
        // Already logged above when revoking, but log if no link was found
        if (!inviteLink) {
          await supabase.from('activity_logs').insert({
            action: 'member_left',
            entity_type: 'group',
            entity_id: chatId,
            details: {
              group_id: chatId,
              group_name: chatMember.chat?.title,
              user_id: user?.id,
              username: user?.username,
              first_name: user?.first_name,
              note: 'No matching invite link found',
            },
            performed_by: 'telegram-webhook',
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
