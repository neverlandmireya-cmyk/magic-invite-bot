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

    const { action, adminCode, botToken, groupIds, notificationGroupId } = await req.json();

    // Validate admin code for all actions
    if (!adminCode || typeof adminCode !== 'string' || adminCode.length < 6) {
      console.error('Invalid admin code');
      return new Response(
        JSON.stringify({ error: "Invalid admin code" }),
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
      console.error('Admin verification failed');
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET settings
    if (action === 'get') {
      const { data: settings, error: getError } = await supabase
        .from('settings')
        .select('key, value');

      if (getError) {
        console.error('Failed to fetch settings:', getError.message);
        return new Response(
          JSON.stringify({ error: "Failed to fetch settings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return settings but mask the bot token
      const result: Record<string, string> = {};
      settings?.forEach((setting) => {
        if (setting.key === 'bot_token') {
          // Only return whether token is set, not the actual value
          result['bot_token_set'] = setting.value ? 'true' : 'false';
          // Return masked version for display
          result['bot_token_masked'] = setting.value 
            ? setting.value.substring(0, 8) + '...' + setting.value.slice(-4)
            : '';
        } else {
          result[setting.key] = setting.value;
        }
      });

      console.log('Settings fetched successfully');
      return new Response(
        JSON.stringify({ success: true, settings: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SAVE settings
    if (action === 'save') {
      // Validate bot token format (basic check)
      if (botToken && typeof botToken === 'string' && botToken.trim()) {
        const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
        if (!tokenPattern.test(botToken.trim())) {
          return new Response(
            JSON.stringify({ error: "Invalid bot token format" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from('settings')
          .upsert({ key: 'bot_token', value: botToken.trim() }, { onConflict: 'key' });
      }

      // Save group IDs (validate JSON format if provided)
      if (groupIds !== undefined) {
        await supabase
          .from('settings')
          .upsert({ key: 'group_ids', value: groupIds }, { onConflict: 'key' });
      }

      // Save notification group ID
      if (notificationGroupId !== undefined) {
        await supabase
          .from('settings')
          .upsert({ key: 'notification_group_id', value: notificationGroupId }, { onConflict: 'key' });
      }

      console.log('Settings saved successfully by admin:', adminData.id);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error('Edge function error:', message);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
