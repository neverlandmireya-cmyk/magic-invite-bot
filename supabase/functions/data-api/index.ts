import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  code: string;
  action: string;
  data?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyCode(supabase: any, code: string) {
  const trimmedCode = code.trim().toUpperCase();

  // Check admin codes
  const { data: adminData } = await supabase
    .from('admin_codes')
    .select('id, code, name, is_active')
    .eq('code', trimmedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (adminData) {
    return { success: true, isAdmin: true, accessCode: trimmedCode, adminId: adminData.id };
  }

  // Check user codes
  const { data: linkData } = await supabase
    .from('invite_links')
    .select('id, access_code, status')
    .eq('access_code', trimmedCode)
    .maybeSingle();

  if (linkData) {
    if (linkData.status === 'banned') {
      return { success: false, error: 'User is banned', isBanned: true };
    }
    return { success: true, isAdmin: false, accessCode: trimmedCode, linkId: linkData.id };
  }

  return { success: false, error: 'Invalid code' };
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

    const { isAdmin, accessCode } = auth;

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

      // ============ GET LINKS ============
      case 'get-links': {
        let query = supabase.from('invite_links').select('*').order('created_at', { ascending: false });

        if (!isAdmin) {
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

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ INSERT LINK ============
      case 'insert-link': {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const linkData = data as Record<string, unknown>;

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
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const filter = (data?.filter || 'all') as string;

        let query = supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filter !== 'all') {
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

      // ============ TICKETS ============
      case 'get-tickets': {
        let query = supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isAdmin) {
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

        const { error } = await supabase
          .from('tickets')
          .insert({
            ...ticketData,
            access_code: accessCode,
          });

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

      case 'update-ticket': {
        const { id, updates } = data as { id: string; updates: Record<string, unknown> };

        // Non-admins can only update their own tickets
        if (!isAdmin) {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('access_code')
            .eq('id', id)
            .single();

          if (ticket?.access_code !== accessCode) {
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

        // Verify ticket access for non-admins
        if (!isAdmin) {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('access_code')
            .eq('id', ticketId)
            .single();

          if (ticket?.access_code !== accessCode) {
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

        // Verify ticket access for non-admins
        if (!isAdmin) {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('access_code')
            .eq('id', ticketId)
            .single();

          if (ticket?.access_code !== accessCode) {
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
            is_admin: isAdmin,
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
