import type { Metadata } from 'next';
import { ContactClient } from './ContactClient';

export const metadata: Metadata = {
  title: 'Nous contacter',
  description:
    "Contactez l’équipe ClickDrive pour toute question sur la location de voitures à Nador : demande d’information, question technique ou partenariat agence.",
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contacter ClickDrive — Location de voitures à Nador',
    description: 'Envoyez-nous un message. Notre équipe traite les demandes sous 24 h ouvrables (lundi–vendredi).',
    url: 'https://clickdrive.ma/contact',
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
