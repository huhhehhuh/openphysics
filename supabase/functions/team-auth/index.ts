import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const appUrl = Deno.env.get('APP_URL')!
const corsHeaders = {
  'Access-Control-Allow-Origin': appUrl,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type TeamAuthRequest = {
  action: 'sign-in' | 'reset-password'
  role?: 'team' | 'teacher'
  name?: string
  teamName?: string
  password?: string
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  const body = await request.json() as TeamAuthRequest
  const role = body.role ?? 'team'
  const name = (body.name ?? body.teamName)?.trim()
  if (!name || !['team', 'teacher'].includes(role) || !['sign-in', 'reset-password'].includes(body.action)) {
    return response({ error: 'Invalid request' }, 400)
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let email: string | undefined
  if (role === 'team') {
    const { data: team, error: teamError } = await admin.from('teams').select('id').eq('name', name).maybeSingle()
    if (teamError) return response({ error: 'Unable to find account' }, 500)
    if (team) {
      const { data: credential, error: credentialError } = await admin
        .from('team_credentials')
        .select('contact_email')
        .eq('team_id', team.id)
        .maybeSingle()
      if (credentialError) return response({ error: 'Unable to find account' }, 500)
      email = credential?.contact_email
    }
  } else {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'teacher')
      .eq('display_name', name)
      .maybeSingle()
    if (profileError) return response({ error: 'Unable to find account' }, 500)
    if (profile) {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id)
      if (userError) return response({ error: 'Unable to find account' }, 500)
      email = userData.user?.email
    }
  }

  if (!email) {
    return body.action === 'reset-password'
      ? response({ ok: true })
      : response({ error: 'Invalid name or password' }, 401)
  }

  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (body.action === 'reset-password') {
    const { error } = await auth.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/`,
    })
    if (error) return response({ error: 'Unable to send reset email' }, 400)
    return response({ ok: true })
  }

  if (!body.password) return response({ error: 'Invalid name or password' }, 401)
  const { data, error } = await auth.auth.signInWithPassword({
    email,
    password: body.password,
  })
  if (error || !data.session) return response({ error: 'Invalid name or password' }, 401)
  return response({ session: data.session })
})
