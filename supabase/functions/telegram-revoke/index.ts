import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    const { adminCode, groupId, inviteLink } = await req.json();

    // Validate input
    if (!adminCode || typeof adminCode !== 'string' || adminCode.length < 6 || adminCode.length > 20) {
      console.error('Invalid admin code format');
      return new Response(
        JSON.stringify({ error: "Invalid admin code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groupId || typeof groupId !== 'string') {
      console.error('Invalid group ID');
      return new Response(
        JSON.stringify({ error: "Group ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!inviteLink || typeof inviteLink !== 'string') {
      console.error('Invalid invite link');
      return new Response(
        JSON.stringify({ error: "Invite link is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin code server-side
    const { data: adminData, error: adminError } = await supabase
      .from('admin_codes')
      .select('id, is_active')
      .eq('code', adminCode.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (adminError || !adminData) {
      console.error('Admin verification failed:', adminError?.message || 'No matching admin code');
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid admin code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bot token from settings (server-side only)
    const { data: tokenSetting, error: tokenError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'bot_token')
      .maybeSingle();

    if (tokenError || !tokenSetting?.value) {
      console.error('Bot token not found:', tokenError?.message);
      return new Response(
        JSON.stringify({ error: "Bot token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = tokenSetting.value;

    // Call Telegram API to revoke the invite link
    console.log('Revoking invite link for group:', groupId, 'link:', inviteLink);
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/revokeChatInviteLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          invite_link: inviteLink,
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram API error:', result.description);
      // Don't fail completely - the link might already be revoked or expired
      return new Response(
        JSON.stringify({ 
          success: false, 
          warning: result.description || "Failed to revoke link on Telegram",
          telegram_error: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Invite link revoked successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Link revoked on Telegram"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error('Edge function error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
