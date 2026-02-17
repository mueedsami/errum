const LOCAL_FRONTEND_PATH_PREFIXES = [
  '/placeholder',
  '/images/',
  '/icons/',
  '/logos/',
  '/favicon',
  '/_next/',
];

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function stripApiSegment(value: string): string {
  return value.replace(/\/api\/?$/, '');
}

/**
 * Returns backend origin URL for serving media assets.
 * Priority: NEXT_PUBLIC_API_URL -> NEXT_PUBLIC_BASE_URL.
 * If value ends with /api, it is removed.
 */
export function getBackendOrigin(): string {
  const raw = String(
    process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      ''
  ).trim();

  if (!raw) return '';

  const withoutTrailing = trimTrailingSlash(raw);
  return stripApiSegment(withoutTrailing);
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function hasProtocolRelativeUrl(value: string): boolean {
  return /^\/\//.test(value);
}

function shouldKeepAsLocalFrontendPath(value: string): boolean {
  return LOCAL_FRONTEND_PATH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Converts relative media path to absolute backend asset URL.
 * Leaves absolute URLs, data/blob URLs, and local frontend assets unchanged.
 */
export function toAbsoluteAssetUrl(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (isAbsoluteHttpUrl(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  if (hasProtocolRelativeUrl(raw)) {
    if (typeof window !== 'undefined' && window.location?.protocol) {
      return `${window.location.protocol}${raw}`;
    }
    return `https:${raw}`;
  }

  if (shouldKeepAsLocalFrontendPath(raw)) {
    return raw;
  }

  let path = raw.replace(/^['"]|['"]$/g, '');

  // Some backends return /api/storage/... for files; strip /api for direct asset access.
  if (/^\/?api\//i.test(path) && /\/storage\//i.test(path)) {
    path = path.replace(/^\/?api\//i, '/');
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const backendOrigin = getBackendOrigin();
  if (!backendOrigin) return path;

  return `${backendOrigin}${path}`;
}
