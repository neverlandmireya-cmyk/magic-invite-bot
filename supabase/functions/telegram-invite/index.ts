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
    const { adminCode, groupId, memberLimit = 1, accessCode } = await req.json();

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

    // Verify admin or reseller code server-side
    const trimmedCode = adminCode.trim().toUpperCase();
    
    // First check admin codes
    const { data: adminData } = await supabase
      .from('admin_codes')
      .select('id, is_active')
      .eq('code', trimmedCode)
      .eq('is_active', true)
      .maybeSingle();

    let isAuthorized = !!adminData;

    // If not admin, check if reseller
    if (!isAuthorized) {
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('id, is_active, group_id')
        .eq('code', trimmedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (resellerData) {
        // Reseller can only create links for their assigned group
        if (resellerData.group_id !== groupId) {
          console.error('Reseller not authorized for this group');
          return new Response(
            JSON.stringify({ error: "Not authorized for this group" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.error('Authorization failed: No matching admin or reseller code');
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid code" }),
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

    // Create link name with the access code
    const linkName = accessCode ? `[CODE] ${accessCode}` : undefined;

    // Call Telegram API server-side
    console.log('Creating invite link for group:', groupId, 'with name:', linkName);
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          member_limit: Math.min(Math.max(1, memberLimit), 99999),
          creates_join_request: false,
          name: linkName, // This name is visible to admins in Telegram
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram API error:', result.description);
      return new Response(
        JSON.stringify({ error: result.description || "Failed to create invite link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Invite link created successfully with name:', linkName);
    return new Response(
      JSON.stringify({ 
        success: true, 
        invite_link: result.result.invite_link,
        expire_date: result.result.expire_date 
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
