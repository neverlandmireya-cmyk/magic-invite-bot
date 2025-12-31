import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Discord webhook logging helper
async function sendDiscordLog(type: string, title: string, description: string, fields?: Array<{name: string, value: string, inline?: boolean}>, color?: number) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_LOGS");
  if (!webhookUrl) {
    console.log("Discord webhook not configured");
    return;
  }

  const colors: Record<string, number> = {
    ban: 0xFF0000,      // Red
    ticket: 0x5865F2,   // Discord blue
    reseller: 0xFFD700, // Gold
    activity: 0x00FF00, // Green
    warning: 0xFFA500,  // Orange
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
          footer: { text: `${type.toUpperCase()} LOG` }
        }]
      })
    });
    console.log(`Discord ${type} log sent`);
  } catch (error) {
    console.error("Failed to send Discord log:", error);
  }
}

interface RequestBody {
  code: string;
  action: string;
  data?: Record<string, unknown>;
}

interface AuthResult {
  success: boolean;
  isAdmin: boolean;
  isReseller: boolean;
  accessCode: string;
  adminId?: string;
  resellerId?: string;
  resellerGroupId?: string;
  resellerCredits?: number;
  linkId?: string;
  error?: string;
  isBanned?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyCode(supabase: any, code: string): Promise<AuthResult> {
  const trimmedCode = code.trim().toUpperCase();

  // Check admin codes
  const { data: adminData } = await supabase
    .from('admin_codes')
    .select('id, code, name, is_active')
    .eq('code', trimmedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (adminData) {
    return { success: true, isAdmin: true, isReseller: false, accessCode: trimmedCode, adminId: adminData.id };
  }

  // Check reseller codes
  const { data: resellerData } = await supabase
    .from('resellers')
    .select('id, code, name, credits, group_id, is_active')
    .eq('code', trimmedCode)
    .maybeSingle();

  if (resellerData) {
    if (!resellerData.is_active) {
      return { success: false, isAdmin: false, isReseller: false, accessCode: trimmedCode, error: 'Reseller is inactive', isBanned: true };
    }
    return { 
      success: true, 
      isAdmin: false, 
      isReseller: true, 
      accessCode: trimmedCode, 
      resellerId: resellerData.id,
      resellerGroupId: resellerData.group_id,
      resellerCredits: resellerData.credits
    };
  }

  // Check user codes
  const { data: linkData } = await supabase
    .from('invite_links')
    .select('id, access_code, status')
    .eq('access_code', trimmedCode)
    .maybeSingle();

  if (linkData) {
    if (linkData.status === 'banned') {
      return { success: false, isAdmin: false, isReseller: false, accessCode: trimmedCode, error: 'User is banned', isBanned: true };
    }
    return { success: true, isAdmin: false, isReseller: false, accessCode: trimmedCode, linkId: linkData.id };
  }

  return { success: false, isAdmin: false, isReseller: false, accessCode: trimmedCode, error: 'Invalid code' };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { code, action, data }: RequestBody = await req.json();

    if (!code || !action) {
      return new Response(
        JSON.stringify({ error: "Code and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify authentication
    const auth = await verifyCode(supabase, code);
    if (!auth.success) {
      return new Response(
        JSON.stringify({ error: auth.error || "Unauthorized", isBanned: auth.isBanned }),
        { status: auth.isBanned ? 403 : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { isAdmin, isReseller, accessCode, resellerGroupId, resellerId } = auth;

    // Route actions
    switch (action) {
      // ============ DASHBOARD STATS ============
      case 'get-dashboard-stats': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: linksData } = await supabase
          .from('invite_links')
          .select('status');

        const stats = { total: 0, active: 0, used: 0, expired: 0 };
        if (linksData) {
          linksData.forEach((link: { status: string }) => {
            stats.total++;
            if (link.status === 'active') stats.active++;
            else if (link.status === 'used') stats.used++;
            else if (link.status === 'expired') stats.expired++;
          });
        }

        const { data: revenueData } = await supabase
          .from('revenue')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: allRevenue } = await supabase
          .from('revenue')
          .select('amount');

        const totalRevenue = allRevenue?.reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0) || 0;

        return new Response(
          JSON.stringify({ success: true, stats, recentRevenue: revenueData || [], totalRevenue }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ RESELLER DASHBOARD ============
      case 'get-reseller-dashboard': {
        if (!isReseller) {
          return new Response(
            JSON.stringify({ error: "Reseller access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get reseller's links
        const { data: linksData } = await supabase
          .from('invite_links')
          .select('status')
          .eq('reseller_code', accessCode);

        const stats = { total: 0, active: 0, used: 0, expired: 0 };
        if (linksData) {
          linksData.forEach((link: { status: string }) => {
            stats.total++;
            if (link.status === 'active') stats.active++;
            else if (link.status === 'used') stats.used++;
            else if (link.status === 'expired') stats.expired++;
          });
        }

        // Get reseller info for credits
        const { data: resellerInfo } = await supabase
          .from('resellers')
          .select('credits, group_name')
          .eq('code', accessCode)
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            stats, 
            credits: resellerInfo?.credits || 0,
            groupName: resellerInfo?.group_name || ''
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ GET LINKS ============
      case 'get-links': {
        let query = supabase.from('invite_links').select('*').order('created_at', { ascending: false });

        if (isReseller) {
          // Resellers only see their own links
          query = query.eq('reseller_code', accessCode);
        } else if (!isAdmin) {
          // Regular users only see their own link
          query = query.eq('access_code', accessCode);
        }

        const { data: linksData, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: linksData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ GET SETTINGS (admin only) ============
      case 'get-settings': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: settings } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', ['group_ids']);

        const { count } = await supabase
          .from('settings')
          .select('*', { count: 'exact', head: true })
          .eq('key', 'bot_token');

        return new Response(
          JSON.stringify({ 
            success: true, 
            settings: settings || [], 
            hasBotToken: (count || 0) > 0 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ UPDATE LINK ============
      case 'update-link': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id, updates } = data as { id: string; updates: Record<string, unknown> };

        // Get link info before update for logging
        const { data: linkBefore } = await supabase
          .from('invite_links')
          .select('access_code, status, group_name, client_email')
          .eq('id', id)
          .single();

        const { error } = await supabase
          .from('invite_links')
          .update(updates)
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log ban actions to Discord
        if (updates.status === 'banned' && linkBefore) {
          await sendDiscordLog('ban', '🚫 User Banned', `Access code **${linkBefore.access_code}** has been banned`, [
            { name: 'Group', value: linkBefore.group_name || 'Unknown', inline: true },
            { name: 'Previous Status', value: linkBefore.status || 'Unknown', inline: true },
            { name: 'Banned By', value: accessCode, inline: true },
            { name: 'Email', value: linkBefore.client_email || 'Not provided', inline: false },
          ]);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ INSERT LINK ============
      case 'insert-link': {
        // Allow admin or reseller to insert links
        if (!isAdmin && !isReseller) {
          return new Response(
            JSON.stringify({ error: "Admin or reseller access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const linkData = data as Record<string, unknown>;

        // If reseller, add reseller_code and enforce group
        if (isReseller) {
          linkData.reseller_code = accessCode;
          linkData.group_id = resellerGroupId;
          
          // Check credits
          const { data: resellerInfo } = await supabase
            .from('resellers')
            .select('credits, group_name')
            .eq('id', resellerId)
            .single();

          if (!resellerInfo || resellerInfo.credits < 1) {
            return new Response(
              JSON.stringify({ error: "Insufficient credits" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          linkData.group_name = resellerInfo.group_name;
        }

        const { data: insertedLink, error } = await supabase
          .from('invite_links')
          .insert(linkData)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Deduct credit from reseller
        if (isReseller) {
          await supabase.rpc('decrement_reseller_credits', { reseller_id: resellerId });
          
          // Fallback if RPC doesn't exist - use direct update
          const { data: currentReseller } = await supabase
            .from('resellers')
            .select('credits')
            .eq('id', resellerId)
            .single();
          
          if (currentReseller) {
            await supabase
              .from('resellers')
              .update({ credits: Math.max(0, currentReseller.credits - 1) })
              .eq('id', resellerId);
          }
        }

        return new Response(
          JSON.stringify({ success: true, data: insertedLink }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ DELETE LINK ============
      case 'delete-link': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id } = data as { id: string };

        const { error } = await supabase
          .from('invite_links')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ REVENUE OPERATIONS ============
      case 'insert-revenue': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const revenueData = data as Record<string, unknown>;

        const { error } = await supabase
          .from('revenue')
          .insert(revenueData);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'delete-revenue': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { accessCodeToDelete } = data as { accessCodeToDelete: string };

        const { error } = await supabase
          .from('revenue')
          .delete()
          .eq('access_code', accessCodeToDelete);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ ACTIVITY LOGS ============
      case 'get-activity-logs': {
        // Admin sees all, reseller sees their own
        if (!isAdmin && !isReseller) {
          return new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const filter = (data?.filter || 'all') as string;
        let query;

        if (isReseller) {
          // Reseller only sees logs for their links
          query = supabase
            .from('activity_logs')
            .select('*')
            .eq('reseller_code', accessCode)
            .in('action', ['member_joined', 'member_left', 'auto_revoke_on_leave'])
            .order('created_at', { ascending: false })
            .limit(100);
        } else if (filter !== 'all') {
          query = supabase
            .from('activity_logs')
            .select('*')
            .eq('action', filter)
            .order('created_at', { ascending: false })
            .limit(100);
        } else {
          query = supabase
            .from('activity_logs')
            .select('*')
            .in('action', ['member_joined', 'member_left', 'auto_revoke_on_leave'])
            .order('created_at', { ascending: false })
            .limit(100);
        }

        const { data: logsData, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: logsData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'insert-activity-log': {
        const logData = data as Record<string, unknown>;

        // If reseller, add reseller_code
        if (isReseller) {
          logData.reseller_code = accessCode;
        }

        const { error } = await supabase
          .from('activity_logs')
          .insert({
            ...logData,
            performed_by: accessCode,
          });

        if (error) {
          console.error('Failed to log activity:', error.message);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ ADMIN CODES ============
      case 'get-admin-codes': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: adminCodes, error } = await supabase
          .from('admin_codes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: adminCodes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'insert-admin-code': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const adminCodeData = data as { name: string; code: string };

        const { error } = await supabase
          .from('admin_codes')
          .insert(adminCodeData);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: error.code }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update-admin-code': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id, updates } = data as { id: string; updates: Record<string, unknown> };

        const { error } = await supabase
          .from('admin_codes')
          .update(updates)
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'delete-admin-code': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id } = data as { id: string };

        const { error } = await supabase
          .from('admin_codes')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ RESELLERS MANAGEMENT ============
      case 'get-resellers': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: resellersData, error } = await supabase
          .from('resellers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: resellersData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'insert-reseller': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const resellerData = data as Record<string, unknown>;

        const { error } = await supabase
          .from('resellers')
          .insert(resellerData);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: error.code }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update-reseller': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id, updates } = data as { id: string; updates: Record<string, unknown> };

        const { error } = await supabase
          .from('resellers')
          .update(updates)
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'delete-reseller': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id } = data as { id: string };

        const { error } = await supabase
          .from('resellers')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'add-reseller-credits': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { id, amount } = data as { id: string; amount: number };

        // Get current credits
        const { data: reseller } = await supabase
          .from('resellers')
          .select('credits')
          .eq('id', id)
          .single();

        if (!reseller) {
          return new Response(
            JSON.stringify({ error: "Reseller not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from('resellers')
          .update({ credits: reseller.credits + amount })
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, newCredits: reseller.credits + amount }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ GET RESELLER DETAILS (for admin viewing a specific reseller) ============
      case 'get-reseller-details': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { resellerCode } = data as { resellerCode: string };

        // Get reseller info
        const { data: resellerInfo, error: resellerError } = await supabase
          .from('resellers')
          .select('*')
          .eq('code', resellerCode)
          .single();

        if (resellerError || !resellerInfo) {
          return new Response(
            JSON.stringify({ error: "Reseller not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get tickets assigned to this reseller (customer tickets + reseller's own tickets)
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('*')
          .eq('reseller_code', resellerCode)
          .order('created_at', { ascending: false });

        // Get activity logs for this reseller's links
        const { data: logsData } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('reseller_code', resellerCode)
          .in('action', ['member_joined', 'member_left', 'auto_revoke_on_leave'])
          .order('created_at', { ascending: false })
          .limit(50);

        // Get links created by this reseller
        const { data: linksData } = await supabase
          .from('invite_links')
          .select('*')
          .eq('reseller_code', resellerCode)
          .order('created_at', { ascending: false });

        return new Response(
          JSON.stringify({ 
            success: true, 
            reseller: resellerInfo,
            tickets: ticketsData || [],
            logs: logsData || [],
            links: linksData || []
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ TICKETS ============
      case 'get-tickets': {
        let query = supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (isReseller) {
          // Resellers only see tickets from their users (not their own tickets)
          query = query.eq('reseller_code', accessCode);
        } else if (isAdmin) {
          // Admins only see tickets that aren't handled by resellers
          // (tickets where reseller_code is null)
          query = query.is('reseller_code', null);
        } else {
          query = query.eq('access_code', accessCode);
        }

        const { data: ticketsData, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: ticketsData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'insert-ticket': {
        const ticketData = data as Record<string, unknown>;

        // If reseller, add reseller_code (for reseller's own tickets)
        if (isReseller) {
          ticketData.reseller_code = accessCode;
        } else if (!isAdmin) {
          // For regular users, check if their link was created by a reseller
          const { data: linkData } = await supabase
            .from('invite_links')
            .select('reseller_code')
            .eq('access_code', accessCode)
            .maybeSingle();
          
          if (linkData?.reseller_code) {
            // This user's link was generated by a reseller, assign ticket to that reseller
            ticketData.reseller_code = linkData.reseller_code;
          }
        }

        const { data: insertedTicket, error } = await supabase
          .from('tickets')
          .insert({
            ...ticketData,
            access_code: accessCode,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Determine if notification goes to reseller or admin
        const assignedResellerCode = ticketData.reseller_code as string | null;

        // Send Telegram notification only for tickets going to admin (not reseller customers)
        // Reseller's own tickets still get notifications; customer tickets to resellers do not
        if (isReseller || !assignedResellerCode) {
          try {
            // Get bot token and notification group ID
            const { data: settings } = await supabase
              .from('settings')
              .select('key, value')
              .in('key', ['bot_token', 'notification_group_id']);

            const botToken = settings?.find((s: { key: string; value: string }) => s.key === 'bot_token')?.value;
            const notificationGroupId = settings?.find((s: { key: string; value: string }) => s.key === 'notification_group_id')?.value;

            if (botToken && notificationGroupId) {
              const subject = (ticketData.subject as string) || 'No subject';
              const ticketMessage = (ticketData.message as string) || '';
              const priority = ((ticketData.priority as string) || 'normal').toUpperCase();

              // Truncate message if too long
              const truncatedMessage = ticketMessage.length > 300 
                ? ticketMessage.substring(0, 300) + '...' 
                : ticketMessage;

              let message: string;

              if (isReseller) {
                // Get reseller name
                const { data: resellerInfo } = await supabase
                  .from('resellers')
                  .select('name')
                  .eq('code', accessCode)
                  .single();

                const resellerName = resellerInfo?.name || 'Unknown';

                message = `🎫 <b>New Reseller Ticket</b>\n\n` +
                  `<b>Reseller:</b> ${resellerName}\n` +
                  `<b>Code:</b> <code>${accessCode}</code>\n` +
                  `<b>Priority:</b> ${priority}\n\n` +
                  `<b>Subject:</b> ${subject}\n\n` +
                  `<b>Message:</b>\n${truncatedMessage}\n\n` +
                  `📋 Check the admin panel to respond.`;
              } else {
                // Regular user ticket - no emojis
                message = `<b>New Support Ticket</b>\n\n` +
                  `<b>User Code:</b> <code>${accessCode}</code>\n` +
                  `<b>Priority:</b> ${priority}\n\n` +
                  `<b>Subject:</b> ${subject}\n\n` +
                  `<b>Message:</b>\n${truncatedMessage}\n\n` +
                  `Check the admin panel to respond.`;
              }

              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: notificationGroupId,
                  text: message,
                  parse_mode: 'HTML',
                }),
              });

              console.log(`Telegram notification sent for ${isReseller ? 'reseller' : 'user'} ticket`);
            }
          } catch (notifError) {
            console.error('Failed to send Telegram notification:', notifError);
            // Don't fail the ticket creation if notification fails
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update-ticket': {
        const { id, updates } = data as { id: string; updates: Record<string, unknown> };

        // Non-admins and non-resellers can only update their own tickets
        if (!isAdmin) {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('access_code, reseller_code')
            .eq('id', id)
            .single();

          if (isReseller) {
            // Resellers can update tickets from their users
            if (ticket?.reseller_code !== accessCode) {
              return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else if (ticket?.access_code !== accessCode) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const { error } = await supabase
          .from('tickets')
          .update(updates)
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ TICKET REPLIES ============
      case 'get-ticket-replies': {
        const { ticketId } = data as { ticketId: string };

        // Verify ticket access
        if (!isAdmin) {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('access_code, reseller_code')
            .eq('id', ticketId)
            .single();

          if (isReseller) {
            if (ticket?.reseller_code !== accessCode) {
              return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else if (ticket?.access_code !== accessCode) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const { data: repliesData, error } = await supabase
          .from('ticket_replies')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: repliesData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'insert-ticket-reply': {
        const { ticketId, message } = data as { ticketId: string; message: string };

        // Verify ticket access
        if (!isAdmin) {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('access_code, reseller_code')
            .eq('id', ticketId)
            .single();

          if (isReseller) {
            if (ticket?.reseller_code !== accessCode) {
              return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else if (ticket?.access_code !== accessCode) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const { error } = await supabase
          .from('ticket_replies')
          .insert({
            ticket_id: ticketId,
            message,
            is_admin: isAdmin || isReseller, // Reseller replies show as admin too
          });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update ticket updated_at
        await supabase
          .from('tickets')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', ticketId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error('Data API error:', message);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});