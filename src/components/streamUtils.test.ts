import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStreamKind, resolveStreamUrlForPlayback } from './streamUtils';

test('detects proxied HLS URLs from the target query parameter', () => {
  const kind = detectStreamKind('/api/hik/proxy-stream?url=https%3A%2F%2Fexample.com%2Fmaster.m3u8');
  assert.equal(kind, 'hls');
});

test('detects direct media URLs even when proxied', () => {
  const kind = detectStreamKind('/api/hik/proxy-stream?url=https%3A%2F%2Fexample.com%2Fclip.mp4');
  assert.equal(kind, 'direct');
});

test('resolves the underlying URL from a proxied stream URL', () => {
  const resolved = resolveStreamUrlForPlayback('/api/hik/proxy-stream?url=https%3A%2F%2Fexample.com%2Fmaster.m3u8');
  assert.equal(resolved, 'https://example.com/master.m3u8');
});
