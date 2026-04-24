/**
 * Parse a user-agent string into structured device info.
 * Lightweight, no dependencies.
 */
export interface ParsedUserAgent {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
}

export function parseUserAgent(ua: string): ParsedUserAgent {
  if (!ua) return { deviceType: 'desktop', os: 'Unknown', browser: 'Unknown' };

  const uaLower = ua.toLowerCase();

  // ── Device Type ───────────────────────────────────────────────────────────
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    deviceType = 'mobile';
  }

  // ── OS ────────────────────────────────────────────────────────────────────
  let os = 'Unknown';
  if (/iphone|ipad|ipod/i.test(ua)) {
    const match = ua.match(/OS ([\d_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/android/i.test(ua)) {
    const match = ua.match(/android ([\d.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/windows nt/i.test(ua)) {
    const versionMap: Record<string, string> = {
      '10.0': 'Windows 10/11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
    };
    const match = ua.match(/windows nt ([\d.]+)/i);
    const v = match?.[1] || '';
    os = versionMap[v] || `Windows NT ${v}`;
  } else if (/mac os x/i.test(ua)) {
    const match = ua.match(/mac os x ([\d_]+)/i);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  } else if (/cros/i.test(ua)) {
    os = 'ChromeOS';
  }

  // ── Browser ───────────────────────────────────────────────────────────────
  let browser = 'Unknown';
  if (/edg\//i.test(ua)) {
    const match = ua.match(/edg\/([\d.]+)/i);
    browser = match ? `Edge ${match[1]}` : 'Edge';
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/firefox\//i.test(ua)) {
    const match = ua.match(/firefox\/([\d.]+)/i);
    browser = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) {
    const match = ua.match(/chrome\/([\d.]+)/i);
    browser = match ? `Chrome ${match[1].split('.')[0]}` : 'Chrome';
  } else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) {
    const match = ua.match(/version\/([\d.]+)/i);
    browser = match ? `Safari ${match[1]}` : 'Safari';
  } else if (/msie|trident/i.test(ua)) {
    browser = 'Internet Explorer';
  }

  return { deviceType, os, browser };
}

/**
 * Extract the real client IP from request headers.
 * Handles Cloudflare, Vercel, and standard proxy headers.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||           // Cloudflare
    headers.get('x-real-ip') ||                  // Nginx proxy
    headers.get('x-forwarded-for')?.split(',')[0].trim() || // Standard proxy chain
    'unknown'
  );
}

/**
 * Get country from Cloudflare header (works on Vercel + Cloudflare proxy).
 */
export function getCountryFromHeaders(headers: Headers): string | null {
  return headers.get('cf-ipcountry') || headers.get('x-vercel-ip-country') || null;
}
