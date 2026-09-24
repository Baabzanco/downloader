import { DownloaderAppError } from './errors.js';
import dns from 'dns/promises';

// Private and reserved IP blocks for SSRF prevention
const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // 169.254.0.0/16 (Link-Local / Cloud Metadata)
  /^0\./, // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
  /^::1$/, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd00:/i,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata.internal',
  '169.254.169.254',
  'instance-data',
]);

// Strictly minimal media CDN hostname regex patterns required by active binary streaming providers
const ALLOWED_CDN_PATTERNS = [
  // TikTok Video & Audio CDNs (ByteDance media delivery only)
  /(^|\.)tiktokcdn\.com$/i,
  /(^|\.)tiktokcdn-us\.com$/i,
  /(^|\.)byteoversea\.com$/i,
  /(^|\.)ibytedtos\.com$/i,
  /(^|\.)tiktokv\.com$/i,
  // Meta Video CDNs (Instagram & Facebook binary media delivery only)
  /(^|\.)cdninstagram\.com$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)rapidcdn\.app$/i,
  // YouTube streaming delivery CDN
  /(^|\.)savenow\.to$/i,
  // X / Twitter Media CDN (explicit video delivery host only)
  /^video\.twimg\.com$/i,
  // Pinterest Video CDNs (explicit video delivery hosts only)
  /^v1\.pinimg\.com$/i,
  /^v2\.pinimg\.com$/i,
];

export class SecurityValidator {
  /**
   * Validates user-submitted URL string for safe protocol and hosts
   */
  public static validateSubmittedUrl(rawUrl: string): URL {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new DownloaderAppError('INVALID_URL', 'URL is required and must be a string.', 400);
    }

    const trimmed = rawUrl.trim();
    if (trimmed.length > 2048) {
      throw new DownloaderAppError('INVALID_URL', 'URL exceeds maximum permitted length of 2048 characters.', 400);
    }

    let parsed: URL;
    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
      const urlToParse = hasScheme ? trimmed : `https://${trimmed}`;
      parsed = new URL(urlToParse);
    } catch {
      throw new DownloaderAppError('INVALID_URL', 'Malformed URL format.', 400);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new DownloaderAppError(
        'INVALID_URL',
        `Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS URLs are accepted.`,
        400
      );
    }

    this.checkSSRFSync(parsed.hostname);

    return parsed;
  }

  /**
   * Synchronous hostname check against known blocked hostnames and IP patterns
   */
  public static checkSSRFSync(hostname: string): void {
    const rawLower = hostname.toLowerCase();
    let lower = rawLower.replace(/^\[|\]$/g, '');

    // Handle IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1
    if (lower.startsWith('::ffff:')) {
      lower = lower.substring(7);
    }

    if (
      lower === '::' ||
      lower === '0.0.0.0' ||
      BLOCKED_HOSTNAMES.has(lower) ||
      BLOCKED_HOSTNAMES.has(rawLower)
    ) {
      throw new DownloaderAppError('SSRF_ATTEMPT', 'Access to internal or loopback hostnames is prohibited.', 403);
    }

    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(lower)) {
        throw new DownloaderAppError('SSRF_ATTEMPT', 'Access to private or link-local IP addresses is prohibited.', 403);
      }
    }
  }

  /**
   * Asynchronous DNS resolution check to guard against DNS rebinding attacks
   */
  public static async checkDNSRebinding(hostname: string): Promise<void> {
    this.checkSSRFSync(hostname);

    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const record of addresses) {
        let ip = record.address.toLowerCase().replace(/^\[|\]$/g, '');
        if (ip.startsWith('::ffff:')) {
          ip = ip.substring(7);
        }
        if (ip === '::' || ip === '0.0.0.0' || BLOCKED_HOSTNAMES.has(ip)) {
          throw new DownloaderAppError(
            'SSRF_ATTEMPT',
            `Resolved IP ${ip} belongs to prohibited internal/loopback address space.`,
            403
          );
        }
        for (const pattern of PRIVATE_IP_PATTERNS) {
          if (pattern.test(ip)) {
            throw new DownloaderAppError(
              'SSRF_ATTEMPT',
              `Resolved IP ${ip} belongs to a prohibited private/reserved address space (DNS rebinding detected).`,
              403
            );
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DownloaderAppError) throw err;
      // If DNS lookup fails, treat as resolution issue or unresolvable domain
      throw new DownloaderAppError(
        'INVALID_URL',
        `Failed to resolve domain: ${hostname}`,
        400
      );
    }
  }

  /**
   * Checks if an upstream media download URL is safe to stream and matches trusted media CDN hosts
   */
  public static validateMediaStreamUrl(streamUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(streamUrl);
    } catch {
      throw new DownloaderAppError('INVALID_URL', 'Invalid media stream URL.', 400);
    }

    // Strictly HTTPS only for media plane streaming (reject protocol downgrade or plaintext HTTP)
    if (parsed.protocol !== 'https:') {
      throw new DownloaderAppError(
        'DOWNLOAD_FAILED',
        `Insecure stream protocol: "${parsed.protocol}". Upstream media streams must use HTTPS.`,
        403
      );
    }

    // Prohibit user credentials in media stream URLs
    if (parsed.username || parsed.password) {
      throw new DownloaderAppError(
        'DOWNLOAD_FAILED',
        'User credentials inside media stream URL are strictly prohibited.',
        403
      );
    }

    // Prohibit non-standard ports
    if (parsed.port && parsed.port !== '443') {
      throw new DownloaderAppError(
        'DOWNLOAD_FAILED',
        `Non-standard port "${parsed.port}" in media stream URL is prohibited.`,
        403
      );
    }

    this.checkSSRFSync(parsed.hostname);

    // Verify host belongs to trusted CDN patterns
    const host = parsed.hostname.toLowerCase();
    const isAllowedCdn = ALLOWED_CDN_PATTERNS.some((pattern) => pattern.test(host));
    if (!isAllowedCdn) {
      throw new DownloaderAppError(
        'DOWNLOAD_FAILED',
        `Target stream host "${host}" is not in the list of authorized media CDNs.`,
        403
      );
    }

    return parsed;
  }

  /**
   * Alias for validateMediaStreamUrl
   */
  public static validateStreamUrl(streamUrl: string): URL {
    return this.validateMediaStreamUrl(streamUrl);
  }

  /**
   * Asynchronously validates media stream URL, including DNS rebinding check
   */
  public static async validateMediaStreamUrlAsync(streamUrl: string): Promise<URL> {
    const parsed = this.validateMediaStreamUrl(streamUrl);
    await this.checkDNSRebinding(parsed.hostname);
    return parsed;
  }

  /**
   * Sanitizes filenames for Content-Disposition header
   */
  public static sanitizeFilename(filename: string): string {
    const cleaned = filename
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/[\x00-\x1f\x7f]/g, '')
      .trim();
    return cleaned.slice(0, 120) || 'media_download';
  }
}
