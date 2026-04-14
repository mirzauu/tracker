import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                    request.nextUrl.pathname.startsWith('/signup') ||
                    request.nextUrl.pathname.startsWith('/auth');

  // Allow cron-triggered push endpoint (uses its own Bearer auth)
  const isCronEndpoint = request.nextUrl.pathname === '/api/push/send';

  if (!token) {
    if (!isAuthPage && !isCronEndpoint) {
      // If it's an API request, return 401 instead of redirecting
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  try {
    await jwtVerify(token, secret);
    
    // User is authenticated
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    
    return NextResponse.next();
  } catch (error) {
    // Invalid token
    if (!isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const response = NextResponse.redirect(url);
      response.cookies.delete('session');
      return response;
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
