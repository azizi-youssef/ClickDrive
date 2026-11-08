import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIpFromRequest } from '../lib/rate-limit';
import { detectImageType, hasValidImageSignature } from '../lib/utils/image-upload';
import { generateTemporaryPassword } from '../lib/utils/agency-credentials';

function requestWith(headers: Record<string, string>) {
  return new Request('https://clickdrive.ma/api/bookings', { headers });
}

test('IP limiteur — l’en-tête de la plateforme prime sur X-Forwarded-For', () => {
  const ip = clientIpFromRequest(
    requestWith({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9', 'x-real-ip': '203.0.113.9' })
  );
  assert.equal(ip, '203.0.113.9');
});

test('IP limiteur — le premier saut falsifiable de X-Forwarded-For est ignoré', () => {
  assert.equal(clientIpFromRequest(requestWith({ 'x-forwarded-for': '6.6.6.6, 198.51.100.4' })), '198.51.100.4');
  assert.equal(clientIpFromRequest(requestWith({ 'x-vercel-forwarded-for': '2001:db8::1' })), '2001:db8::1');
});

test('IP limiteur — valeurs invalides rejetées', () => {
  assert.equal(clientIpFromRequest(requestWith({ 'x-real-ip': '<script>' })), 'unknown');
  assert.equal(clientIpFromRequest(requestWith({})), 'unknown');
});

test('Images — format détecté depuis le contenu, pas depuis le type déclaré', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const html = new TextEncoder().encode('<html><script>alert(1)</script>');

  assert.deepEqual(detectImageType(png), { mimeType: 'image/png', extension: 'png' });
  assert.deepEqual(detectImageType(jpeg), { mimeType: 'image/jpeg', extension: 'jpg' });
  assert.deepEqual(detectImageType(webp), { mimeType: 'image/webp', extension: 'webp' });
  assert.equal(detectImageType(html), null);
  assert.equal(hasValidImageSignature('image/png', html), false);
  assert.equal(hasValidImageSignature('image/png', jpeg), false);
  assert.equal(hasValidImageSignature('image/jpg', jpeg), true);
});

test('Mots de passe temporaires — complexité respectée et valeurs non répétées', () => {
  const generated = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const pwd = generateTemporaryPassword(14);
    assert.equal(pwd.length, 14);
    assert.match(pwd, /[A-Z]/);
    assert.match(pwd, /[a-z]/);
    assert.match(pwd, /[2-9]/);
    assert.match(pwd, /[!@#$%&*_-]/);
    generated.add(pwd);
  }
  assert.equal(generated.size, 200);
});
