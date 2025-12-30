import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`Receipt storage action: ${action}`);

    if (action === 'upload') {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const linkId = formData.get('linkId') as string;
      const adminCode = formData.get('adminCode') as string;

      if (!file || !linkId || !adminCode) {
        console.error('Missing required fields for upload');
        return new Response(
          JSON.stringify({ error: 'Missing required fields: file, linkId, adminCode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate admin code server-side
      const { data: adminCodeData, error: adminCodeError } = await supabase
        .from('admin_codes')
        .select('id, is_active')
        .eq('code', adminCode)
        .eq('is_active', true)
        .single();

      if (adminCodeError || !adminCodeData) {
        console.error('Invalid admin code:', adminCodeError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid admin code' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upload file with service role
      const fileExt = file.name.split('.').pop();
      const fileName = `${linkId}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return new Response(
          JSON.stringify({ error: 'Failed to upload file' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate a signed URL for the uploaded file (1 year expiry for storage in DB)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (signedUrlError) {
        console.error('Signed URL error:', signedUrlError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate signed URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Upload successful:', fileName);
      return new Response(
        JSON.stringify({ 
          success: true, 
          url: signedUrlData.signedUrl,
          fileName 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get-signed-url') {
      // Generate a fresh signed URL for viewing
      const body = await req.json();
      const { filePath, adminCode } = body;

      if (!filePath || !adminCode) {
        console.error('Missing required fields for signed URL');
        return new Response(
          JSON.stringify({ error: 'Missing required fields: filePath, adminCode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate admin code server-side
      const { data: adminCodeData, error: adminCodeError } = await supabase
        .from('admin_codes')
        .select('id, is_active')
        .eq('code', adminCode)
        .eq('is_active', true)
        .single();

      if (adminCodeError || !adminCodeData) {
        console.error('Invalid admin code:', adminCodeError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid admin code' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract filename from stored URL or path
      let fileName = filePath;
      // If it's a full URL, extract just the filename
      if (filePath.includes('/')) {
        const urlParts = filePath.split('/');
        fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(fileName, 60 * 60); // 1 hour expiry for viewing

      if (signedUrlError) {
        console.error('Signed URL error:', signedUrlError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate signed URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Signed URL generated for:', fileName);
      return new Response(
        JSON.stringify({ 
          success: true, 
          url: signedUrlData.signedUrl 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: upload, get-signed-url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Receipt storage error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
