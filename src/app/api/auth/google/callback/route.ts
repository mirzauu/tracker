import { oauth2Client } from '@/utils/googleAuth';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to a file for persistence (local dev)
    const tokenPath = path.join(process.cwd(), 'token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens));

    // Redirect back to the home page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error getting tokens:', error);
    return NextResponse.json({ error: 'Failed to exchange code for tokens' }, { status: 500 });
  }
}
