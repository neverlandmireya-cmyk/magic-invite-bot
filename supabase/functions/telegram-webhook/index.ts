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
  console.log(`Sending message to chat ${chatId}: ${text.substring(0, 50)}...`);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    
    const result = await response.json();
    console.log('Telegram sendMessage response:', JSON.stringify(result));
    
    if (!result.ok) {
      console.error('Failed to send message:', result.description);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

// Check if user is admin (by checking admin_codes table with their Telegram ID)
async function isAdminUser(supabase: any, telegramUserId: number): Promise<boolean> {
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

// Parse group_ids setting (JSON array of objects with id and name)
function parseGroupIds(value: string): Array<{id: string, name: string}> {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(g => g.id && typeof g.id === 'string');
    }
    return [];
  } catch {
    return [];
  }
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

    // Get command bot token (for sending messages/responses)
    const { data: commandTokenSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'command_bot_token')
      .maybeSingle();

    // Get link bot token (for generating invite links) - fallback to legacy bot_token
    const { data: linkTokenSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'link_bot_token')
      .maybeSingle();
    
    const { data: legacyTokenSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'bot_token')
      .maybeSingle();

    const commandBotToken = commandTokenSetting?.value;
    const linkBotToken = linkTokenSetting?.value || legacyTokenSetting?.value;

    console.log('Command bot configured:', !!commandBotToken);
    console.log('Link bot configured:', !!linkBotToken);

    // Test action to verify bot tokens
    if (update.action === 'test_bot') {
      const results: any = { ok: true };
      
      if (commandBotToken) {
        const commandBotInfo = await fetch(`https://api.telegram.org/bot${commandBotToken}/getMe`);
        results.command_bot = await commandBotInfo.json();
      }
      
      if (linkBotToken) {
        const linkBotInfo = await fetch(`https://api.telegram.org/bot${linkBotToken}/getMe`);
        results.link_bot = await linkBotInfo.json();
      }
      
      console.log('Bot info:', JSON.stringify(results));
      
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle bot commands (messages starting with /)
    if (update.message?.text?.startsWith('/')) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const username = message.from.username || message.from.first_name || 'User';
      const text = message.text;
      const command = text.split(' ')[0].toLowerCase().replace('@', '').split('@')[0];
      const args = text.split(' ').slice(1);

      console.log(`Command received: ${command} from user ${userId} (${username})`);

      if (!commandBotToken) {
        console.log('Command bot token not configured');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user is authorized admin
      const isAdmin = await isAdminUser(supabase, userId);

      switch (command) {
        case '/start': {
          const welcomeMsg = isAdmin 
            ? `🎉 <b>Hello ${username}!</b>\n\nYou are an authorized admin.\n\n<b>Available commands:</b>\n/generate [group] - Generate invite link\n/groups - List available groups\n/status [code] - Check link status\n/revoke [code] - Revoke a link\n/stats - View statistics\n/help - Show help`
            : `👋 <b>Hello ${username}!</b>\n\nYou don't have admin permissions.\n\nContact the administrator to get access.`;
          
          await sendTelegramMessage(commandBotToken, chatId, welcomeMsg);
          break;
        }

        case '/help': {
          if (!isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❌ You don\'t have permission to use this bot.');
            break;
          }
          
          const helpMsg = `📚 <b>Bot Commands</b>\n\n` +
            `/generate [group] - Generate a new invite link\n` +
            `  • Without args: uses first configured group\n` +
            `  • With number: uses group by index (1, 2, 3...)\n` +
            `  • With name: searches by group name\n` +
            `/groups - List all configured groups\n` +
            `/status [code] - Check link status\n` +
            `/revoke [code] - Revoke an active link\n` +
            `/stats - Show general statistics\n` +
            `/myid - Show your Telegram ID`;
          
          await sendTelegramMessage(commandBotToken, chatId, helpMsg);
          break;
        }

        case '/myid': {
          await sendTelegramMessage(commandBotToken, chatId, `🆔 Your Telegram ID: <code>${userId}</code>`);
          break;
        }

        case '/groups': {
          if (!isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❌ You don\'t have permission to use this bot.');
            break;
          }

          // Get configured groups
          const { data: groupsSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'group_ids')
            .maybeSingle();

          const groups = groupsSetting?.value ? parseGroupIds(groupsSetting.value) : [];

          if (groups.length === 0) {
            await sendTelegramMessage(commandBotToken, chatId, '⚠️ No groups configured. Add groups in the Settings panel.');
            break;
          }

          let groupsMsg = `📋 <b>Configured Groups</b>\n\n`;
          groups.forEach((g, i) => {
            groupsMsg += `${i + 1}. <b>${g.name}</b>\n   ID: <code>${g.id}</code>\n\n`;
          });
          groupsMsg += `\n💡 Use /generate 1 to generate for the first group, /generate 2 for the second, etc.`;
          
          await sendTelegramMessage(commandBotToken, chatId, groupsMsg);
          break;
        }

        case '/generate': {
          if (!isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❌ You don\'t have permission to generate links.');
            break;
          }

          if (!linkBotToken) {
            await sendTelegramMessage(commandBotToken, chatId, '⚠️ Link Bot is not configured. Set it up in Settings.');
            break;
          }

          // Get configured groups
          const { data: groupsSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'group_ids')
            .maybeSingle();

          const groups = groupsSetting?.value ? parseGroupIds(groupsSetting.value) : [];

          if (groups.length === 0) {
            await sendTelegramMessage(commandBotToken, chatId, '⚠️ No groups configured. Add groups in the Settings panel.');
            break;
          }

          // Determine which group to use
          let selectedGroup = groups[0];
          
          if (args[0]) {
            const arg = args[0];
            // Check if it's a number (index)
            const idx = parseInt(arg);
            if (!isNaN(idx) && idx >= 1 && idx <= groups.length) {
              selectedGroup = groups[idx - 1];
            } else {
              // Search by name (partial match)
              const found = groups.find(g => 
                g.name.toLowerCase().includes(arg.toLowerCase())
              );
              if (found) {
                selectedGroup = found;
              } else {
                await sendTelegramMessage(commandBotToken, chatId, 
                  `❌ Group not found: "${arg}"\n\nUse /groups to see available groups.`);
                break;
              }
            }
          }

          const groupId = selectedGroup.id;
          const groupName = selectedGroup.name;
          const accessCode = generateAccessCode();

          // Create invite link via Telegram API using LINK BOT
          const inviteResponse = await fetch(`https://api.telegram.org/bot${linkBotToken}/createChatInviteLink`, {
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
            console.error('Telegram API error:', inviteResult);
            await sendTelegramMessage(commandBotToken, chatId, 
              `❌ Error: ${inviteResult.description || 'Could not create link'}\n\n` +
              `Make sure the Link Bot (@${linkBotToken.split(':')[0]}...) is admin in the group.`);
            break;
          }

          // Save to database
          await supabase.from('invite_links').insert({
            invite_link: inviteResult.result.invite_link,
            group_id: groupId,
            group_name: groupName,
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
              group_id: groupId,
              group_name: groupName,
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
            { name: 'Group', value: groupName, inline: true },
            { name: 'By', value: `@${username}`, inline: true },
          ]);

          const successMsg = `✅ <b>Link Generated</b>\n\n` +
            `📁 <b>Group:</b> ${groupName}\n` +
            `📋 <b>Code:</b> <code>${accessCode}</code>\n` +
            `🔗 <b>Link:</b> ${inviteResult.result.invite_link}\n\n` +
            `<i>Valid for 1 use only.</i>`;
          
          await sendTelegramMessage(commandBotToken, chatId, successMsg);
          break;
        }

        case '/status': {
          if (!isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❌ You don\'t have permission to check status.');
            break;
          }

          if (!args[0]) {
            await sendTelegramMessage(commandBotToken, chatId, '⚠️ Usage: /status [code]\nExample: /status ABC123');
            break;
          }

          const code = args[0].toUpperCase();
          const { data: link } = await supabase
            .from('invite_links')
            .select('*')
            .eq('access_code', code)
            .maybeSingle();

          if (!link) {
            await sendTelegramMessage(commandBotToken, chatId, `❌ Code not found: ${code}`);
            break;
          }

          const statusEmoji: Record<string, string> = {
            'active': '🟢',
            'used': '🔵',
            'revoked': '🔴',
            'closed_by_telegram': '⚫',
            'banned': '🚫',
          };

          const statusMsg = `📊 <b>Link Status</b>\n\n` +
            `📋 <b>Code:</b> <code>${link.access_code}</code>\n` +
            `${statusEmoji[link.status] || '⚪'} <b>Status:</b> ${link.status}\n` +
            `📁 <b>Group:</b> ${link.group_name || 'N/A'}\n` +
            `📧 <b>Email:</b> ${link.client_email || 'N/A'}\n` +
            `📝 <b>Note:</b> ${link.note || 'N/A'}\n` +
            `📅 <b>Created:</b> ${new Date(link.created_at).toLocaleString('en-US')}`;
          
          await sendTelegramMessage(commandBotToken, chatId, statusMsg);
          break;
        }

        case '/revoke': {
          if (!isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❌ You don\'t have permission to revoke links.');
            break;
          }

          if (!args[0]) {
            await sendTelegramMessage(commandBotToken, chatId, '⚠️ Usage: /revoke [code]\nExample: /revoke ABC123');
            break;
          }

          if (!linkBotToken) {
            await sendTelegramMessage(commandBotToken, chatId, '⚠️ Link Bot is not configured.');
            break;
          }

          const code = args[0].toUpperCase();
          const { data: link } = await supabase
            .from('invite_links')
            .select('*')
            .eq('access_code', code)
            .maybeSingle();

          if (!link) {
            await sendTelegramMessage(commandBotToken, chatId, `❌ Code not found: ${code}`);
            break;
          }

          if (link.status !== 'active') {
            await sendTelegramMessage(commandBotToken, chatId, `⚠️ Link is no longer active (status: ${link.status})`);
            break;
          }

          // Revoke on Telegram using LINK BOT
          const revokeResponse = await fetch(`https://api.telegram.org/bot${linkBotToken}/revokeChatInviteLink`, {
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

          await sendTelegramMessage(commandBotToken, chatId, `✅ Link <code>${code}</code> revoked successfully.`);
          break;
        }

        case '/stats': {
          if (!isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❌ You don\'t have permission to view statistics.');
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

          const statsMsg = `📊 <b>Statistics</b>\n\n` +
            `🟢 <b>Active:</b> ${activeLinks?.length || 0}\n` +
            `🔵 <b>Used:</b> ${usedLinks?.length || 0}\n` +
            `🔴 <b>Revoked:</b> ${revokedLinks?.length || 0}\n` +
            `📊 <b>Total:</b> ${totalLinks?.length || 0}`;
          
          await sendTelegramMessage(commandBotToken, chatId, statsMsg);
          break;
        }

        default:
          if (isAdmin) {
            await sendTelegramMessage(commandBotToken, chatId, '❓ Unknown command. Use /help to see available commands.');
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

        if (linkRecord && linkBotToken) {
          console.log(`Found link record: ${linkRecord.access_code}`);

          // Revoke the link on Telegram using LINK BOT
          const revokeUrl = `https://api.telegram.org/bot${linkBotToken}/revokeChatInviteLink`;
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
