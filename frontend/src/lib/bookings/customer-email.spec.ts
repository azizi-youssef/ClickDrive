import { describe, expect, it } from 'vitest';
import { deliverableCustomerEmail, isPlaceholderCustomerEmail, placeholderCustomerEmail } from './customer-email';

describe('Adresse de substitution d’un client sans e-mail', () => {
  it('est construite à partir des chiffres du téléphone', () => {
    expect(placeholderCustomerEmail('+212 6 12-34-56-78')).toBe('212612345678@clickdrive.ma');
  });

  it('est reconnue, quelle que soit la casse ou les espaces', () => {
    expect(isPlaceholderCustomerEmail('212612345678@clickdrive.ma')).toBe(true);
    expect(isPlaceholderCustomerEmail(' 0612345678@ClickDrive.MA ')).toBe(true);
    expect(isPlaceholderCustomerEmail(placeholderCustomerEmail(''))).toBe(true);
  });

  it('ne confond pas une vraie adresse, même sur le domaine clickdrive.ma', () => {
    expect(isPlaceholderCustomerEmail('sara@example.com')).toBe(false);
    expect(isPlaceholderCustomerEmail('contact@clickdrive.ma')).toBe(false);
    expect(isPlaceholderCustomerEmail('rif.car2@clickdrive.ma')).toBe(false);
    expect(isPlaceholderCustomerEmail('0612345678@clickdrive.ma.example.com')).toBe(false);
    expect(isPlaceholderCustomerEmail(null)).toBe(false);
  });

  it('n’est jamais un destinataire', () => {
    expect(deliverableCustomerEmail('0612345678@clickdrive.ma')).toBeNull();
    expect(deliverableCustomerEmail('')).toBeNull();
    expect(deliverableCustomerEmail(undefined)).toBeNull();
    expect(deliverableCustomerEmail(' sara@example.com ')).toBe('sara@example.com');
  });
});
