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
    const { code } = await req.json();

    // Validate input
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: "Code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedCode = code.trim().toUpperCase();

    // Validate code format (alphanumeric, 6-20 characters)
    if (trimmedCode.length < 6 || trimmedCode.length > 20 || !/^[A-Z0-9]+$/.test(trimmedCode)) {
      console.log('Invalid code format attempted:', trimmedCode.substring(0, 3) + '...');
      return new Response(
        JSON.stringify({ error: "Invalid code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if it's an admin code
    const { data: adminData } = await supabase
      .from('admin_codes')
      .select('id, code, name, is_active')
      .eq('code', trimmedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (adminData) {
      // Update last_used_at
      await supabase
        .from('admin_codes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', adminData.id);

      console.log('Admin login successful:', adminData.name);
      return new Response(
        JSON.stringify({
          success: true,
          type: 'admin',
          data: {
            accessCode: trimmedCode,
            adminId: adminData.id,
            adminName: adminData.name,
            isAdmin: true,
            isReseller: false,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if it's a reseller code
    const { data: resellerData } = await supabase
      .from('resellers')
      .select('id, code, name, credits, group_id, group_name, is_active')
      .eq('code', trimmedCode)
      .maybeSingle();

    if (resellerData) {
      if (!resellerData.is_active) {
        console.log('Inactive reseller attempted login:', trimmedCode);
        return new Response(
          JSON.stringify({
            success: false,
            error: "This reseller account is inactive",
            isBanned: true
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_used_at
      await supabase
        .from('resellers')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', resellerData.id);

      console.log('Reseller login successful:', resellerData.name);
      return new Response(
        JSON.stringify({
          success: true,
          type: 'reseller',
          data: {
            accessCode: trimmedCode,
            resellerId: resellerData.id,
            resellerName: resellerData.name,
            credits: resellerData.credits,
            groupId: resellerData.group_id,
            groupName: resellerData.group_name,
            isAdmin: false,
            isReseller: true,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if it's a user invite link code
    const { data: linkData, error: linkError } = await supabase
      .from('invite_links')
      .select('id, access_code, status')
      .eq('access_code', trimmedCode)
      .maybeSingle();

    if (linkError) {
      console.error('Database error verifying code:', linkError.message);
      return new Response(
        JSON.stringify({ error: "Failed to verify code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (linkData) {
      // Check if user is banned
      if (linkData.status === 'banned') {
        console.log('Banned user attempted login:', trimmedCode);
        return new Response(
          JSON.stringify({
            success: false,
            error: "This user is banned",
            isBanned: true
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('User login successful with access code');
      return new Response(
        JSON.stringify({
          success: true,
          type: 'user',
          data: {
            accessCode: linkData.access_code,
            linkId: linkData.id,
            isAdmin: false,
            isReseller: false,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Code not found
    console.log('Invalid code attempted');
    return new Response(
      JSON.stringify({ error: "Invalid access code" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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