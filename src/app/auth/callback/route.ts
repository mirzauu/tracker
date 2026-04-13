import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { profiles, plans } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // Check if profile exists
      const existingProfile = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
      
      if (existingProfile.length === 0) {
        // Get Free plan ID
        const [freePlan] = await db.select().from(plans).where(eq(plans.name, 'Free')).limit(1)
        
        if (freePlan) {
          await db.insert(profiles).values({
            id: user.id,
            email: user.email!,
            fullName: user.user_metadata.full_name,
            avatarUrl: user.user_metadata.avatar_url,
            planId: freePlan.id,
          })
        }
      }
      
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be certain that "origin" is the http://localhost:3000
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
