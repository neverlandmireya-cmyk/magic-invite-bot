import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Discord webhook logging helper
async function sendDiscordLog(type: string, title: string, description: string, fields?: Array<{name: string, value: string, inline?: boolean}>, color?: number) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_LOGS");
  if (!webhookUrl) {
    console.log("Discord webhook not configured");
    return;
  }

  const colors: Record<string, number> = {
    join: 0x00FF00,     // Green
    leave: 0xFF6B6B,    // Soft red
    revoke: 0xFF0000,   // Red
    activity: 0x5865F2, // Discord blue
    bot: 0x00BFFF,      // Bot commands - light blue
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title,
          description,
          color: color || colors[type] || 0x5865F2,
          fields: fields || [],
          timestamp: new Date().toISOString(),
          footer: { text: `TELEGRAM ${type.toUpperCase()}` }
        }]
      })
    });
    console.log(`Discord ${type} log sent`);
  } catch (error) {
    console.error("Failed to send Discord log:", error);
  }
}

// Generate random access code
function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Send message to Telegram
async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, parseMode = 'HTML') {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
  return response.json();
}

// Check if user is admin (by checking admin_codes table with their Telegram ID)
async function isAdminUser(supabase: any, telegramUserId: number): Promise<boolean> {
  // Check if there's a setting that maps this Telegram user to admin
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'telegram_admin_ids')
    .maybeSingle();
  
  if (data?.value) {
    const adminIds = data.value.split(',').map((id: string) => id.trim());
    return adminIds.includes(String(telegramUserId));
  }
  return false;
}

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

    // Get bot token from settings
    const { data: tokenSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'bot_token')
      .maybeSingle();

    const botToken = tokenSetting?.value;

    // Handle bot commands (messages starting with /)
    if (update.message?.text?.startsWith('/')) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const username = message.from.username || message.from.first_name || 'Usuario';
      const text = message.text;
      const command = text.split(' ')[0].toLowerCase().replace('@', '').split('@')[0];
      const args = text.split(' ').slice(1);

      console.log(`Command received: ${command} from user ${userId} (${username})`);

      if (!botToken) {
        console.log('Bot token not configured');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user is authorized admin
      const isAdmin = await isAdminUser(supabase, userId);

      switch (command) {
        case '/start': {
          const welcomeMsg = isAdmin 
            ? `🎉 <b>¡Hola ${username}!</b>\n\nEres administrador autorizado.\n\n<b>Comandos disponibles:</b>\n/generate - Generar enlace de invitación\n/status [código] - Ver estado de un enlace\n/revoke [código] - Revocar un enlace\n/stats - Ver estadísticas\n/help - Ayuda`
            : `👋 <b>¡Hola ${username}!</b>\n\nNo tienes permisos de administrador.\n\nContacta al administrador para obtener acceso.`;
          
          await sendTelegramMessage(botToken, chatId, welcomeMsg);
          break;
        }

        case '/help': {
          if (!isAdmin) {
            await sendTelegramMessage(botToken, chatId, '❌ No tienes permisos para usar este bot.');
            break;
          }
          
          const helpMsg = `📚 <b>Comandos del Bot</b>\n\n` +
            `/generate - Genera un nuevo enlace de invitación\n` +
            `/status [código] - Consulta el estado de un enlace\n` +
            `/revoke [código] - Revoca un enlace activo\n` +
            `/stats - Muestra estadísticas generales\n` +
            `/myid - Muestra tu ID de Telegram`;
          
          await sendTelegramMessage(botToken, chatId, helpMsg);
          break;
        }

        case '/myid': {
          await sendTelegramMessage(botToken, chatId, `🆔 Tu ID de Telegram: <code>${userId}</code>`);
          break;
        }

        case '/generate': {
          if (!isAdmin) {
            await sendTelegramMessage(botToken, chatId, '❌ No tienes permisos para generar enlaces.');
            break;
          }

          // Get configured group ID
          const { data: groupSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'group_id')
            .maybeSingle();

          if (!groupSetting?.value) {
            await sendTelegramMessage(botToken, chatId, '⚠️ No hay grupo configurado. Configura el Group ID en el panel.');
            break;
          }

          const groupId = groupSetting.value;
          const accessCode = generateAccessCode();

          // Create invite link via Telegram API
          const inviteResponse = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: groupId,
              member_limit: 1,
              creates_join_request: false,
              name: `[CODE] ${accessCode}`,
            }),
          });

          const inviteResult = await inviteResponse.json();

          if (!inviteResult.ok) {
            await sendTelegramMessage(botToken, chatId, `❌ Error: ${inviteResult.description || 'No se pudo crear el enlace'}`);
            break;
          }

          // Get group name
          const { data: groupNameSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'group_name')
            .maybeSingle();

          // Save to database
          await supabase.from('invite_links').insert({
            invite_link: inviteResult.result.invite_link,
            group_id: groupId,
            group_name: groupNameSetting?.value || 'Telegram Group',
            access_code: accessCode,
            status: 'active',
          });

          // Log activity
          await supabase.from('activity_logs').insert({
            action: 'create_link',
            entity_type: 'invite_link',
            entity_id: accessCode,
            details: { 
              access_code: accessCode,
              generated_via: 'telegram_bot',
              telegram_user: username,
              telegram_user_id: userId,
            },
            performed_by: `telegram:${username}`,
          });

          // Send Discord log
          await sendDiscordLog('bot', '🤖 Link Generated via Bot', 
            `New link created from Telegram`, [
            { name: 'Code', value: accessCode, inline: true },
            { name: 'By', value: `@${username}`, inline: true },
          ]);

          const successMsg = `✅ <b>Enlace generado</b>\n\n` +
            `📋 <b>Código:</b> <code>${accessCode}</code>\n` +
            `🔗 <b>Enlace:</b> ${inviteResult.result.invite_link}\n\n` +
            `<i>El enlace es válido para 1 uso.</i>`;
          
          await sendTelegramMessage(botToken, chatId, successMsg);
          break;
        }

        case '/status': {
          if (!isAdmin) {
            await sendTelegramMessage(botToken, chatId, '❌ No tienes permisos para consultar estados.');
            break;
          }

          if (!args[0]) {
            await sendTelegramMessage(botToken, chatId, '⚠️ Uso: /status [código]\nEjemplo: /status ABC123');
            break;
          }

          const code = args[0].toUpperCase();
          const { data: link } = await supabase
            .from('invite_links')
            .select('*')
            .eq('access_code', code)
            .maybeSingle();

          if (!link) {
            await sendTelegramMessage(botToken, chatId, `❌ No se encontró el código: ${code}`);
            break;
          }

          const statusEmoji: Record<string, string> = {
            'active': '🟢',
            'used': '🔵',
            'revoked': '🔴',
            'closed_by_telegram': '⚫',
            'banned': '🚫',
          };

          const statusMsg = `📊 <b>Estado del enlace</b>\n\n` +
            `📋 <b>Código:</b> <code>${link.access_code}</code>\n` +
            `${statusEmoji[link.status] || '⚪'} <b>Estado:</b> ${link.status}\n` +
            `📁 <b>Grupo:</b> ${link.group_name || 'N/A'}\n` +
            `📧 <b>Email:</b> ${link.client_email || 'N/A'}\n` +
            `📝 <b>Nota:</b> ${link.note || 'N/A'}\n` +
            `📅 <b>Creado:</b> ${new Date(link.created_at).toLocaleString('es-ES')}`;
          
          await sendTelegramMessage(botToken, chatId, statusMsg);
          break;
        }

        case '/revoke': {
          if (!isAdmin) {
            await sendTelegramMessage(botToken, chatId, '❌ No tienes permisos para revocar enlaces.');
            break;
          }

          if (!args[0]) {
            await sendTelegramMessage(botToken, chatId, '⚠️ Uso: /revoke [código]\nEjemplo: /revoke ABC123');
            break;
          }

          const code = args[0].toUpperCase();
          const { data: link } = await supabase
            .from('invite_links')
            .select('*')
            .eq('access_code', code)
            .maybeSingle();

          if (!link) {
            await sendTelegramMessage(botToken, chatId, `❌ No se encontró el código: ${code}`);
            break;
          }

          if (link.status !== 'active') {
            await sendTelegramMessage(botToken, chatId, `⚠️ El enlace ya no está activo (estado: ${link.status})`);
            break;
          }

          // Revoke on Telegram
          const revokeResponse = await fetch(`https://api.telegram.org/bot${botToken}/revokeChatInviteLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: link.group_id,
              invite_link: link.invite_link,
            }),
          });

          const revokeResult = await revokeResponse.json();

          // Update database
          await supabase
            .from('invite_links')
            .update({ status: 'revoked' })
            .eq('id', link.id);

          // Log activity
          await supabase.from('activity_logs').insert({
            action: 'revoke_link',
            entity_type: 'invite_link',
            entity_id: link.id,
            details: { 
              access_code: code,
              revoked_via: 'telegram_bot',
              telegram_user: username,
              telegram_revoked: revokeResult.ok,
            },
            performed_by: `telegram:${username}`,
          });

          // Send Discord log
          await sendDiscordLog('revoke', '🔴 Link Revoked via Bot', 
            `Link **${code}** revoked from Telegram`, [
            { name: 'By', value: `@${username}`, inline: true },
            { name: 'Telegram OK', value: revokeResult.ok ? '✅' : '❌', inline: true },
          ]);

          await sendTelegramMessage(botToken, chatId, `✅ Enlace <code>${code}</code> revocado exitosamente.`);
          break;
        }

        case '/stats': {
          if (!isAdmin) {
            await sendTelegramMessage(botToken, chatId, '❌ No tienes permisos para ver estadísticas.');
            break;
          }

          // Get stats
          const { data: activeLinks } = await supabase
            .from('invite_links')
            .select('id', { count: 'exact' })
            .eq('status', 'active');

          const { data: usedLinks } = await supabase
            .from('invite_links')
            .select('id', { count: 'exact' })
            .eq('status', 'used');

          const { data: revokedLinks } = await supabase
            .from('invite_links')
            .select('id', { count: 'exact' })
            .in('status', ['revoked', 'closed_by_telegram', 'banned']);

          const { data: totalLinks } = await supabase
            .from('invite_links')
            .select('id', { count: 'exact' });

          const statsMsg = `📊 <b>Estadísticas</b>\n\n` +
            `🟢 <b>Activos:</b> ${activeLinks?.length || 0}\n` +
            `🔵 <b>Usados:</b> ${usedLinks?.length || 0}\n` +
            `🔴 <b>Revocados:</b> ${revokedLinks?.length || 0}\n` +
            `📊 <b>Total:</b> ${totalLinks?.length || 0}`;
          
          await sendTelegramMessage(botToken, chatId, statsMsg);
          break;
        }

        default:
          if (isAdmin) {
            await sendTelegramMessage(botToken, chatId, '❓ Comando no reconocido. Usa /help para ver los comandos disponibles.');
          }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        if (!linkRecord && chatId) {
          const { data } = await supabase
            .from('invite_links')
            .select('*')
            .eq('group_id', chatId)
            .eq('status', 'used')
            .order('used_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data?.used_at) {
            const usedAt = new Date(data.used_at);
            const now = new Date();
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            if (usedAt > hourAgo) {
              linkRecord = data;
            }
          }
        }

        if (linkRecord && botToken) {
          console.log(`Found link record: ${linkRecord.access_code}`);

          // Revoke the link on Telegram
          const revokeUrl = `https://api.telegram.org/bot${botToken}/revokeChatInviteLink`;
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

          // Update status in database
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

          // Send Discord log for auto-revoke
          await sendDiscordLog('revoke', '⚠️ Auto-Revoked: User Left Group', 
            `Link **${linkRecord.access_code}** was automatically revoked`, [
            { name: 'Username', value: user?.username ? `@${user.username}` : 'N/A', inline: true },
            { name: 'User ID', value: String(user?.id || 'Unknown'), inline: true },
            { name: 'Group', value: chatMember.chat?.title || chatId || 'Unknown', inline: true },
            { name: 'Telegram Revoked', value: revokeResult.ok ? '✅ Yes' : '❌ Failed', inline: true },
          ]);

          console.log(`Link ${linkRecord.access_code} revoked automatically`);
        } else {
          console.log('No matching link record found for this user');
        }
      }

      // Handle when member uses a link to join
      if (newStatus === 'member' && inviteLink) {
        console.log(`User ${user?.id} joined using invite link: ${inviteLink}`);
        
        const { data: joinedLink } = await supabase
          .from('invite_links')
          .select('*')
          .eq('invite_link', inviteLink)
          .maybeSingle();

        if (joinedLink) {
          await supabase
            .from('invite_links')
            .update({ 
              status: 'used',
              used_at: new Date().toISOString(),
            })
            .eq('id', joinedLink.id);

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

          await sendDiscordLog('join', '✅ Member Joined', 
            `User joined via link **${joinedLink.access_code}**`, [
            { name: 'Username', value: user?.username ? `@${user.username}` : 'N/A', inline: true },
            { name: 'Name', value: user?.first_name || 'Unknown', inline: true },
            { name: 'Group', value: chatMember.chat?.title || chatId || 'Unknown', inline: true },
          ]);

          console.log('Link marked as used and join logged');
        }
      }

      // Log when member leaves (even if no link found)
      if (wasActiveMember && hasLeft && !inviteLink) {
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
