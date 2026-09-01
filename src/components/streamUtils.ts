export type StreamKind = 'hls' | 'direct' | 'unknown';

export function detectStreamKind(url: string | null | undefined): StreamKind {
  if (!url) return 'unknown';

  const normalized = decodeURIComponent(url).trim();
  const queryIndex = normalized.indexOf('?');
  const candidate = queryIndex >= 0 ? normalized.slice(queryIndex + 1) : normalized;

  const maybeUrl = candidate.includes('url=')
    ? candidate.split('url=')[1]?.split('&')[0]
    : normalized;

  const target = decodeURIComponent(maybeUrl || normalized);

  if (/\.m3u8($|\?)/i.test(target) || target.includes('mpegurl')) return 'hls';
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(target)) return 'direct';
  if (target.startsWith('http')) return 'direct';
  return 'unknown';
}

export function resolveStreamUrlForPlayback(url: string | null | undefined): string | null {
  if (!url) return null;

  const normalized = decodeURIComponent(url).trim();
  const queryIndex = normalized.indexOf('?');
  if (queryIndex < 0) return normalized;

  const params = new URLSearchParams(normalized.slice(queryIndex));
  const target = params.get('url');
  return target ? decodeURIComponent(target) : normalized;
}
