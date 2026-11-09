import { describe, expect, it } from 'vitest';
import { contactMessageSchema } from './contact';

const valid = {
  name: '  Karim Benali ',
  email: 'karim@example.com',
  phone: '',
  category: 'reservation',
  subject: '',
  message: 'Bonjour, je cherche une voiture automatique pour trois jours en décembre.',
};

describe('Formulaire de contact — validation serveur', () => {
  it('nettoie les champs et ramène les champs facultatifs vides à null', () => {
    const parsed = contactMessageSchema.parse(valid);
    expect(parsed.name).toBe('Karim Benali');
    expect(parsed.phone).toBeNull();
    expect(parsed.subject).toBeNull();
  });

  it.each([
    [{ email: 'karim@' }, 'Adresse e-mail invalide'],
    [{ message: 'Trop court' }, 'Le message doit contenir au moins 20 caractères'],
    [{ category: 'spam' }, 'Veuillez choisir une catégorie'],
    [{ phone: '06<script>' }, 'Numéro de téléphone invalide'],
    [{ name: 'K' }, 'Le nom est requis'],
  ])('refuse %o', (patch, message) => {
    const result = contactMessageSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('borne la longueur du message (5 000 caractères)', () => {
    expect(contactMessageSchema.safeParse({ ...valid, message: 'a'.repeat(5001) }).success).toBe(false);
  });
});
