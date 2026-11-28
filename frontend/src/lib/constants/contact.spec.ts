import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, supportHoursRows, supportHoursSummary, toInternationalDigits, whatsappUrl } from './contact';

describe('Coordonnées de la plateforme (config/site.ts)', () => {
  it('liens WhatsApp au format international https://wa.me/212…, message encodé', () => {
    expect(whatsappUrl('Bonjour, Clio 5 du 10 au 13 déc.', '0775546247')).toBe(
      `https://wa.me/212775546247?text=${encodeURIComponent('Bonjour, Clio 5 du 10 au 13 déc.')}`
    );
    expect(whatsappUrl(undefined, '+212 6 12 34 56 78')).toBe('https://wa.me/212612345678');
    expect(toInternationalDigits('00212612345678')).toBe('212612345678');
    expect(toInternationalDigits('212612345678')).toBe('212612345678');
  });

  it('numéro lisible', () => {
    expect(formatPhoneDisplay('212612345678')).toBe('+212 6 12 34 56 78');
  });

  it('horaires du support : lun.–ven. 9h–18h, sam. 9h–13h', () => {
    expect(supportHoursSummary('fr')).toBe('lun.–ven. 9h–18h · sam. 9h–13h');
    expect(supportHoursRows('fr')).toEqual([
      { day: 'Lundi – vendredi', hours: '9h–18h' },
      { day: 'Samedi', hours: '9h–13h' },
    ]);
    expect(supportHoursSummary('en')).toBe('Mon–Fri 9am–6pm · Sat 9am–1pm');
  });
});
