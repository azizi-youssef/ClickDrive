import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  distributed: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: mocks.distributed,
  checkRateLimit: () => ({ ok: true }),
  clientIpFromRequest: () => '203.0.113.7',
}));

vi.mock('@/lib/services/contact.service', async () => {
  class ContactUnavailableError extends Error {}
  return { submitContactMessage: mocks.submit, ContactUnavailableError };
});

import { POST } from './route';
import { ContactUnavailableError } from '@/lib/services/contact.service';

const valid = {
  name: 'Karim Benali',
  email: 'karim@example.com',
  phone: '',
  category: 'agency-partner',
  subject: 'Inscription de mon agence',
  message: 'Bonjour, je gère une agence à Selouane et je souhaite rejoindre ClickDrive.',
};

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  mocks.submit.mockReset();
  mocks.distributed.mockReset().mockResolvedValue({ ok: true });
});

describe('POST /api/contact', () => {
  it('message valide : enregistré, référence renvoyée (201)', async () => {
    mocks.submit.mockResolvedValue({ reference: 'MSG-20261108-ABC234', teamNotified: 'sent', acknowledged: 'sent' });
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, reference: 'MSG-20261108-ABC234', acknowledged: true });
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Karim Benali', phone: null }));
  });

  it('champ piège rempli (robot) : refusé sans rien enregistrer', async () => {
    const res = await post({ ...valid, website: 'https://spam.example' });
    expect(res.status).toBe(400);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('formulaire invalide : 400 avec le message du champ fautif', async () => {
    const res = await post({ ...valid, email: 'karim@' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.email).toBe('Adresse e-mail invalide');
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('trop de messages depuis la même adresse : 429 avec Retry-After', async () => {
    mocks.distributed.mockResolvedValue({ ok: false, retryAfterSec: 120 });
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('120');
  });

  it('base indisponible : 503 honnête, jamais un faux « envoyé »', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.submit.mockRejectedValue(new ContactUnavailableError('Base de données indisponible'));
    const res = await post(valid);
    expect(res.status).toBe(503);
    expect((await res.json()).success).toBe(false);
  });
});
