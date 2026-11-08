'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { brandLogo } from '@/lib/brand/logo';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { verifyAdminPortalLogin, verifyAgencyPortalLogin } from '@/lib/auth/login-guard';
import {
  LOGIN_PATH,
  canPortalAccessRedirect,
  isSafeRedirect,
  loginUrl,
  parseLoginPortal,
  portalForRole,
  PORTAL_DEFAULT_REDIRECT,
  type LoginPortal,
} from '@/lib/auth/login-portals';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { USER_ROLES } from '@clickdrive/shared';

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;
const MIN_PASSWORD_LENGTH = 8;

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
};
type LoginStatus = 'idle' | 'submitting' | 'resetting' | 'success';

const PORTAL_COPY: Record<
  LoginPortal,
  {
    eyebrow: string;
    title: string;
    titleAccent: string;
    copy: string;
    accessLabel: string;
    formSubtitle: string;
    emailPlaceholder: string;
    emailLabel: string;
    trust: string;
    help: string;
    submitLabel: string;
  }
> = {
  client: {
    eyebrow: 'Espace client',
    title: 'Vos trajets,',
    titleAccent: 'vos réservations.',
    copy: 'Retrouvez vos demandes, devis PDF et l’historique de vos locations à Nador.',
    accessLabel: 'Espace client',
    formSubtitle: 'Connectez-vous pour synchroniser vos réservations et favoris.',
    emailPlaceholder: 'vous@example.com',
    emailLabel: 'Adresse e-mail',
    trust: 'Connexion sécurisée. Google disponible pour les clients.',
    help: 'Utilisez « Mot de passe oublié » ou contactez ClickDrive si vous ne retrouvez pas votre compte.',
    submitLabel: 'Se connecter',
  },
  agency: {
    eyebrow: 'Portail partenaire',
    title: 'Votre flotte,',
    titleAccent: 'sous contrôle.',
    copy: 'Gérez véhicules, tarifs et réservations depuis un seul tableau de bord.',
    accessLabel: 'Portail agence',
    formSubtitle: 'E-mail professionnel pour accéder à votre flotte et vos réservations.',
    emailPlaceholder: 'contact@votre-agence.ma',
    emailLabel: 'E-mail professionnel',
    trust: 'Accès réservé aux agences partenaires autorisées.',
    help: 'Mot de passe oublié ou agence non activée ? Contactez le responsable ClickDrive.',
    submitLabel: 'Accéder à mon espace',
  },
  admin: {
    eyebrow: 'Administration plateforme',
    title: 'Votre parc,',
    titleAccent: 'sous contrôle.',
    copy: 'Validez les agences, la commission et la marketplace depuis l’administration.',
    accessLabel: 'Espace administrateur',
    formSubtitle: 'Connectez-vous pour gérer la plateforme ClickDrive.',
    emailPlaceholder: 'admin@clickdrive.ma',
    emailLabel: 'Adresse e-mail',
    trust: 'Accès réservé aux administrateurs autorisés.',
    help: 'Contactez le responsable ClickDrive pour vérifier votre compte ou réinitialiser votre mot de passe.',
    submitLabel: 'Se connecter',
  },
};

const PORTAL_FEATURES: Record<
  LoginPortal,
  { icon: React.ComponentType<{ className?: string }>; label: string }[]
> = {
  client: [
    { icon: CarFront, label: 'Locations' },
    { icon: UserRound, label: 'Profil' },
    { icon: Calendar, label: 'Historique' },
  ],
  agency: [
    { icon: CarFront, label: 'Flotte' },
    { icon: Building2, label: 'Agence' },
    { icon: Calendar, label: 'Réservations' },
  ],
  admin: [
    { icon: CarFront, label: 'Annonces' },
    { icon: UsersRound, label: 'Agences' },
    { icon: MessageSquare, label: 'Demandes' },
  ],
};

const URL_ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'Vous n’avez pas accès à cet espace avec ce compte.',
  auth_failed: 'La connexion a échoué ou a été annulée. Réessayez.',
};

const loginStyles = `
  .cd-login {
    --cd-graphite: #0B1220;
    --cd-red: #E63946;
    --cd-red-hover: #B4232F;
    --cd-bg: #F5F6F8;
    --cd-surface: #FFFFFF;
    --cd-text: #0B1220;
    --cd-muted: #5B6474;
    --cd-subtle: #667085;
    --cd-action: #C92F3B;
    --cd-line: #E3E6EB;
    --cd-field: #F5F6F8;
    color-scheme: light;
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    min-height: 100vh;
    min-height: 100svh;
    width: 100%;
    background: var(--cd-bg);
    color: var(--cd-text);
    font-family: var(--font-sans), 'Plus Jakarta Sans', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .cd-login, .cd-login * { box-sizing: border-box; }
  .cd-login :where(h1, h2, p) { margin: 0; }
  .cd-login :where(a) { color: inherit; text-decoration: none; }
  .cd-login :where(button, input) { font: inherit; }
  .cd-login :where(button) { cursor: pointer; }
  .cd-login svg { display: block; flex-shrink: 0; }
  .cd-login :is(a, button, summary):focus-visible {
    outline: 2px solid var(--cd-red);
    outline-offset: 3px;
    border-radius: 8px;
  }

  /* ── Panneau de marque (graphite) ───────────────────────────── */
  .cd-brand {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: clamp(32px, 4vw, 56px);
    background: var(--cd-graphite);
    color: #fff;
  }
  .cd-brand::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%);
    pointer-events: none;
  }
  .cd-brand::after {
    content: '';
    position: absolute;
    z-index: -1;
    right: -140px;
    bottom: -160px;
    width: 460px;
    height: 460px;
    border-radius: 50%;
    background: rgba(230,57,70,.28);
    filter: blur(110px);
    pointer-events: none;
  }
  .cd-road-art {
    position: absolute;
    z-index: -1;
    right: -105px;
    bottom: -100px;
    width: min(920px, 145%);
    height: auto;
    pointer-events: none;
  }
  .cd-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: #FF6B76;
  }
  .cd-eyebrow::before { content: ''; width: 26px; height: 1px; background: currentColor; }
  .cd-hero {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    padding: 48px 0;
  }
  .cd-hero-title {
    margin-top: 22px;
    max-width: 520px;
    font-size: clamp(40px, 4vw, 62px);
    line-height: 1.04;
    font-weight: 800;
    letter-spacing: -.035em;
  }
  .cd-hero-title span { color: var(--cd-red); }
  .cd-hero-copy {
    max-width: 400px;
    margin-top: 22px;
    color: #B7BECB;
    font-size: 16px;
    line-height: 1.75;
  }
  .cd-features {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    max-width: 460px;
    margin-top: 36px;
  }
  .cd-feature {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 16px;
    background: rgba(255,255,255,.04);
    color: #E6E9EF;
    font-size: 13px;
    font-weight: 700;
  }
  .cd-feature svg {
    width: 34px;
    height: 34px;
    padding: 8px;
    border-radius: 10px;
    background: rgba(230,57,70,.16);
    color: #FF6B76;
  }
  .cd-brand-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,.1);
    font-size: 12px;
    color: #8F98A8;
  }
  .cd-location { display: inline-flex; align-items: center; gap: 7px; }
  .cd-location svg { width: 14px; height: 14px; color: #FF6B76; }

  /* ── Colonne formulaire (claire) ────────────────────────────── */
  .cd-access {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 24px clamp(20px, 4vw, 64px) 20px;
  }
  .cd-topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .cd-logo { display: inline-flex; align-items: center; }
  .cd-logo img { display: block; width: 168px; height: auto; }
  .cd-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--cd-line);
    border-radius: 12px;
    background: var(--cd-surface);
    color: var(--cd-muted);
    font-size: 13px;
    font-weight: 600;
    transition: color .2s ease, border-color .2s ease;
  }
  .cd-back svg { width: 16px; height: 16px; transition: transform .2s ease; }
  .cd-back:hover { color: var(--cd-text); border-color: #C9CED6; }
  .cd-back:hover svg { transform: translateX(-3px); }
  .cd-form-content {
    width: 100%;
    max-width: 460px;
    margin: auto;
    padding: 36px 0 28px;
    animation: cd-enter .45s ease both;
  }
  .cd-card {
    padding: clamp(24px, 3vw, 36px);
    border: 1px solid var(--cd-line);
    border-radius: 24px;
    background: var(--cd-surface);
    box-shadow: 0 1px 2px rgba(11,18,32,.04), 0 24px 60px -32px rgba(11,18,32,.28);
  }

  /* Sélecteur de portail */
  .cd-portal-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-bottom: 26px;
    padding: 4px;
    border-radius: 14px;
    background: var(--cd-field);
  }
  .cd-portal-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    border-radius: 10px;
    color: var(--cd-muted);
    font-size: 13px;
    font-weight: 700;
    transition: background .2s ease, color .2s ease;
  }
  .cd-portal-tab svg { width: 16px; height: 16px; }
  .cd-portal-tab:hover { color: var(--cd-text); }
  .cd-portal-tab[aria-current='page'] {
    background: var(--cd-surface);
    color: var(--cd-text);
    box-shadow: 0 1px 3px rgba(11,18,32,.1);
  }
  .cd-portal-tab[aria-current='page'] svg { color: var(--cd-red); }
  .cd-admin-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 24px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--cd-graphite);
    color: #C3C9D4;
    font-size: 12px;
  }
  .cd-admin-note > span { display: inline-flex; align-items: center; gap: 8px; color: #fff; font-weight: 700; }
  .cd-admin-note svg { width: 16px; height: 16px; color: #FF6B76; }
  .cd-admin-note a { color: #FF9CA5; font-weight: 700; }

  .cd-form-header { margin-bottom: 24px; }
  .cd-form-header h1 {
    font-size: clamp(28px, 2.6vw, 34px);
    font-weight: 800;
    letter-spacing: -.03em;
    line-height: 1.15;
  }
  .cd-form-header p { margin-top: 8px; color: var(--cd-muted); font-size: 14px; line-height: 1.65; }

  .cd-form { display: grid; gap: 18px; }
  .cd-field label { display: block; margin-bottom: 8px; color: var(--cd-text); font-size: 13px; font-weight: 700; }
  .cd-label-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .cd-label-row label { margin-bottom: 0; }
  .cd-link-btn {
    min-height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--cd-action);
    font-size: 12px;
    font-weight: 700;
  }
  .cd-link-btn:hover:not(:disabled) { text-decoration: underline; }
  .cd-link-btn:disabled { cursor: not-allowed; opacity: .55; }
  .cd-input-wrap { position: relative; }
  .cd-input-icon {
    position: absolute;
    top: 50%;
    left: 16px;
    width: 18px;
    height: 18px;
    transform: translateY(-50%);
    color: var(--cd-subtle);
    pointer-events: none;
    transition: color .2s ease;
  }
  .cd-input {
    display: block;
    width: 100%;
    height: 52px;
    padding: 0 16px 0 46px;
    border: 1px solid var(--cd-line);
    border-radius: 12px;
    background: var(--cd-field);
    color: var(--cd-text);
    font-size: 16px;
    font-weight: 500;
    outline: 2px solid transparent;
    transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
  }
  .cd-input::placeholder { color: var(--cd-subtle); opacity: 1; font-weight: 400; }
  .cd-input:hover:not(:disabled) { border-color: #C9CED6; }
  .cd-input:focus {
    border-color: var(--cd-graphite);
    background: var(--cd-surface);
    box-shadow: 0 0 0 4px rgba(11,18,32,.08);
  }
  .cd-input:-webkit-autofill,
  .cd-input:-webkit-autofill:hover,
  .cd-input:-webkit-autofill:focus {
    -webkit-text-fill-color: var(--cd-text);
    -webkit-box-shadow: 0 0 0 1000px #EEF2F8 inset;
    transition: background-color 9999s ease-out 0s;
  }
  .cd-input-wrap:focus-within .cd-input-icon { color: var(--cd-graphite); }
  .cd-input[aria-invalid='true'] { border-color: var(--cd-red); background: #FFF6F7; }
  .cd-input:disabled { opacity: .6; cursor: not-allowed; }
  .cd-input-password { padding-right: 54px; }
  .cd-toggle-password {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--cd-subtle);
    transition: color .2s ease, background .2s ease;
  }
  .cd-toggle-password:hover:not(:disabled) { color: var(--cd-text); background: rgba(11,18,32,.05); }
  .cd-toggle-password svg { width: 18px; height: 18px; }
  .cd-field-error, .cd-caps-hint, .cd-hint { margin-top: 7px; font-size: 12px; line-height: 1.55; }
  .cd-field-error { color: #C1121F; font-weight: 600; }
  .cd-caps-hint { color: #A15C07; font-weight: 600; }
  .cd-hint { color: var(--cd-muted); }
  .cd-alert, .cd-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 20px;
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.55;
  }
  .cd-alert { border: 1px solid #F8C9CD; background: #FFF4F5; color: #9B1C26; }
  .cd-notice { border: 1px solid #BFE8D3; background: #F0FBF5; color: #17603F; }
  .cd-alert svg, .cd-notice svg { width: 17px; height: 17px; margin-top: 1px; }
  .cd-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    margin-top: 4px;
    padding: 12px 18px;
    border: 0;
    border-radius: 12px;
    background: var(--cd-action);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    box-shadow: 0 14px 28px -14px rgba(230,57,70,.75);
    transition: background .2s ease, transform .1s ease;
  }
  .cd-submit svg { width: 18px; height: 18px; transition: transform .2s ease; }
  .cd-submit:hover:not(:disabled) { background: var(--cd-red-hover); }
  .cd-submit:hover:not(:disabled) svg:last-child { transform: translateX(3px); }
  .cd-submit:active:not(:disabled) { transform: translateY(1px); }
  .cd-submit:disabled { cursor: not-allowed; opacity: .65; box-shadow: none; }
  .cd-submit[data-success='true'] { background: #1F7A4D; opacity: 1; }
  .cd-spinner { animation: cd-spin .8s linear infinite; }
  .cd-countdown { color: var(--cd-muted); font-size: 12px; text-align: center; }
  .cd-oauth { margin-top: 20px; display: grid; gap: 14px; }
  .cd-oauth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--cd-subtle);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .12em;
  }
  .cd-oauth-divider::before, .cd-oauth-divider::after { content: ''; flex: 1; height: 1px; background: var(--cd-line); }
  .cd-join { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--cd-line); text-align: center; font-size: 13px; color: var(--cd-muted); }
  .cd-join a { display: inline-flex; min-height: 32px; align-items: center; color: var(--cd-action); font-weight: 700; }
  .cd-join a:hover { text-decoration: underline; }
  .cd-trust {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 20px;
    padding: 0 4px;
    color: var(--cd-muted);
    font-size: 12px;
    line-height: 1.6;
  }
  .cd-trust svg { width: 16px; height: 16px; margin-top: 1px; color: #1F7A4D; }
  .cd-help { margin-top: 4px; padding: 0 4px; color: var(--cd-muted); font-size: 12px; line-height: 1.7; }
  .cd-help summary { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; font-weight: 700; color: var(--cd-text); cursor: pointer; list-style: none; }
  .cd-help summary::-webkit-details-marker { display: none; }
  .cd-help summary svg { width: 14px; height: 14px; transition: transform .2s ease; }
  .cd-help[open] summary svg { transform: rotate(180deg); }
  .cd-access-footer { color: var(--cd-subtle); font-size: 11px; text-align: center; }
  .cd-mobile-hero { display: none; }
  .cd-skeleton { height: 52px; border: 1px solid var(--cd-line); border-radius: 12px; background: var(--cd-surface); }
  .cd-skeleton-label { height: 12px; width: 94px; margin-bottom: 12px; border-radius: 4px; background: var(--cd-line); }
  .cd-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  @keyframes cd-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cd-spin { to { transform: rotate(360deg); } }

  /* RTL : icônes et bouton d'affichage du mot de passe côté début/fin logique */
  [dir='rtl'] .cd-input-icon { left: auto; right: 16px; }
  [dir='rtl'] .cd-input { padding: 0 46px 0 16px; }
  [dir='rtl'] .cd-input-password { padding-left: 54px; }
  [dir='rtl'] .cd-toggle-password { right: auto; left: 4px; }
  [dir='rtl'] .cd-back svg, [dir='rtl'] .cd-submit svg:last-child { transform: scaleX(-1); }

  /* ── Tablette & mobile : une seule colonne, bandeau de marque compact ── */
  @media (max-width: 959px) {
    .cd-login { display: block; }
    .cd-brand { display: none; }
    .cd-access { min-height: 100svh; padding: 16px 20px 20px; }
    .cd-mobile-hero {
      display: block;
      width: 100%;
      max-width: 520px;
      margin: 18px auto 0;
      padding: 22px 22px 50px;
      border-radius: 22px;
      background: var(--cd-graphite) radial-gradient(circle at 100% 0%, rgba(230,57,70,.35), transparent 55%);
      color: #fff;
    }
    .cd-mobile-hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #FF6B76; }
    .cd-mobile-hero-title { margin-top: 8px; font-size: 24px; font-weight: 800; line-height: 1.2; letter-spacing: -.02em; }
    .cd-mobile-hero-title span { color: var(--cd-red); }
    .cd-form-content { max-width: 520px; margin: -30px auto 0; padding-top: 0; }
  }
  @media (max-width: 400px) {
    .cd-access { padding-inline: 14px; }
    .cd-card { padding: 22px 18px; border-radius: 20px; }
    .cd-logo img { width: 140px; }
    .cd-back span, .cd-tab-extra { display: none; }
    .cd-back { padding: 0 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cd-form-content { animation: none; }
    .cd-spinner { animation-duration: 1.8s; }
    .cd-back svg, .cd-submit svg, .cd-help summary svg { transition: none; }
    .cd-back:hover svg, .cd-submit:hover:not(:disabled) svg:last-child { transform: none; }
  }
`;

function LoginStyles() {
  return <style dangerouslySetInnerHTML={{ __html: loginStyles }} />;
}

/* Logo sur fond clair (le gris de « Drive » manque de contraste sur le panneau graphite) */
function BrandLogo() {
  return (
    <Link href="/" className="cd-logo" aria-label="ClickDrive — Accueil">
      <Image src={brandLogo} alt="ClickDrive" sizes="168px" priority />
    </Link>
  );
}

function BrandPanel({ portal }: { portal: LoginPortal }) {
  const copy = PORTAL_COPY[portal];
  const features = PORTAL_FEATURES[portal];

  return (
    <aside className="cd-brand" aria-label="ClickDrive">
      <div className="cd-eyebrow">{copy.eyebrow}</div>
      <svg className="cd-road-art" aria-hidden="true" viewBox="0 0 720 720" fill="none">
        <path d="M805 60H492c-112 0-202 90-202 202v63c0 84-68 152-152 152H-92" stroke="#e63946" strokeOpacity=".06" strokeWidth="148" />
        <path d="M805 60H492c-112 0-202 90-202 202v63c0 84-68 152-152 152H-92" stroke="#e63946" strokeOpacity=".2" strokeWidth="2" strokeDasharray="10 16" />
      </svg>
      <div className="cd-hero">
        <p className="cd-hero-title">
          {copy.title}
          <br />
          <span>{copy.titleAccent}</span>
        </p>
        <p className="cd-hero-copy">{copy.copy}</p>
        <div className="cd-features">
          {features.map(({ icon: Icon, label }) => (
            <span key={label} className="cd-feature">
              <Icon aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="cd-brand-footer">
        <span className="cd-location">
          <MapPin aria-hidden="true" />
          Nador, Maroc
        </span>
        <span>Votre activité. Une seule interface.</span>
      </div>
    </aside>
  );
}

function PortalLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portal = parseLoginPortal(searchParams?.get('portal'));
  const isRegistration = portal === 'client' && searchParams?.get('mode') === 'signup';
  const copy = PORTAL_COPY[portal];

  const redirectParam = searchParams?.get('redirect');
  const redirectUrl = isSafeRedirect(redirectParam) && canPortalAccessRedirect(portal, redirectParam)
    ? redirectParam
    : PORTAL_DEFAULT_REDIRECT[portal];

  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmationRef = useRef<HTMLInputElement>(null);
  const requestPending = useRef(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockLeft, setLockLeft] = useState(0);

  const busy = status !== 'idle';
  const locked = lockLeft > 0;

  // Changement de portail ou de mode (connexion / inscription) : on repart d'un formulaire propre.
  useEffect(() => {
    setError(null);
    setNotice(null);
    setFieldErrors({});
    setPassword('');
    setPasswordConfirmation('');
    setShowPassword(false);
    setCapsLock(false);
  }, [portal, isRegistration]);

  useEffect(() => {
    const code = searchParams?.get('error');
    if (code && URL_ERROR_MESSAGES[code]) {
      setError(URL_ERROR_MESSAGES[code]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (lockUntil === null) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockLeft(remaining);
      if (remaining === 0) {
        setLockUntil(null);
        setError(null);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [lockUntil]);

  const startCooldown = () => {
    setLockLeft(LOCK_SECONDS);
    setLockUntil(Date.now() + LOCK_SECONDS * 1000);
    setAttempts(0);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current || locked) return;

    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim();
    const nextErrors: FieldErrors = {};
    if (isRegistration && !fullName.trim()) nextErrors.name = 'Saisissez votre nom complet.';
    if (!normalizedEmail) nextErrors.email = 'Saisissez votre adresse e-mail.';
    else if (emailRef.current?.validity.typeMismatch) nextErrors.email = 'Adresse e-mail invalide.';
    if (!password) nextErrors.password = 'Saisissez votre mot de passe.';
    else if (isRegistration && password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    }
    if (isRegistration && password !== passwordConfirmation) {
      nextErrors.passwordConfirmation = 'Les mots de passe ne correspondent pas.';
    }
    setFieldErrors(nextErrors);
    if (nextErrors.name || nextErrors.email || nextErrors.password || nextErrors.passwordConfirmation) {
      (nextErrors.name ? nameRef : nextErrors.email ? emailRef : nextErrors.password ? passwordRef : passwordConfirmationRef).current?.focus();
      return;
    }

    requestPending.current = true;
    setStatus('submitting');
    let authenticated = false;

    try {
      if (!isSupabaseConfigured()) {
        setError('La connexion est momentanément indisponible. Contactez ClickDrive.');
        return;
      }
      const supabase = createClient();
      if (!supabase) {
        setError('Service indisponible. Réessayez dans quelques instants.');
        return;
      }

      const authResult = isRegistration
        ? await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/account')}`,
          },
        })
        : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      const { data, error: signInError } = authResult;

      if (signInError) {
        if (signInError.status === 429) {
          startCooldown();
          setError('Trop de tentatives. Patientez avant de réessayer.');
        } else if (signInError.status !== undefined && signInError.status >= 500) {
          setError('Service indisponible. Réessayez dans quelques instants.');
        } else {
          const nextAttempts = attempts + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            startCooldown();
            setError('Plusieurs tentatives ont échoué. Patientez avant de réessayer.');
          } else {
            setAttempts(nextAttempts);
            setError(isRegistration
              ? 'Création du compte impossible. Vérifiez les informations saisies ou connectez-vous si vous possédez déjà un compte.'
              : 'Connexion refusée. Vérifiez vos identifiants.');
          }
          setPassword('');
          window.requestAnimationFrame(() => passwordRef.current?.focus());
        }
        return;
      }

      if (!data.session || !data.user) {
        if (isRegistration && data.user) {
          setNotice('Compte créé. Consultez votre e-mail pour confirmer votre adresse avant de vous connecter.');
          setPassword('');
          setPasswordConfirmation('');
          return;
        }
        setError('La connexion n’a pas abouti. Réessayez.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      const role = USER_ROLES.find((candidate) => candidate === profile?.role);
      const authenticatedPortal = role ? portalForRole(role) : null;
      if (profileError || !authenticatedPortal) {
        await supabase.auth.signOut();
        setError(profileError
          ? 'Impossible de vérifier le rôle de votre compte. Réessayez.'
          : 'Ce compte ne possède pas de rôle de portail autorisé.');
        return;
      }

      if (authenticatedPortal === 'admin') {
        const portalError = await verifyAdminPortalLogin(supabase, data.user.id);
        if (portalError) {
          setError(portalError);
          setPassword('');
          return;
        }
      } else if (authenticatedPortal === 'agency') {
        const portalError = await verifyAgencyPortalLogin(supabase, data.user.id);
        if (portalError) {
          setError(portalError);
          setPassword('');
          return;
        }
      }

      setStatus('success');
      const destination = isSafeRedirect(redirectParam) &&
        canPortalAccessRedirect(authenticatedPortal, redirectParam)
        ? redirectParam
        : PORTAL_DEFAULT_REDIRECT[authenticatedPortal];
      router.replace(destination);
      router.refresh();
      authenticated = true;
    } catch {
      setError(isRegistration
        ? 'Création du compte impossible. Vérifiez votre réseau et réessayez.'
        : 'Connexion impossible. Vérifiez votre réseau.');
    } finally {
      if (!authenticated) {
        requestPending.current = false;
        setStatus('idle');
      }
    }
  };

  const handleForgotPassword = async () => {
    if (requestPending.current || locked || portal === 'admin') return;
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || emailRef.current?.validity.typeMismatch) {
      setFieldErrors((c) => ({ ...c, email: 'Saisissez votre e-mail pour recevoir le lien.' }));
      emailRef.current?.focus();
      return;
    }

    requestPending.current = true;
    setStatus('resetting');
    try {
      const supabase = createClient();
      if (!supabase || !isSupabaseConfigured()) {
        setError('Réinitialisation indisponible pour le moment.');
        return;
      }
      const resetReturn = loginUrl(portal);
      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetReturn)}`,
      });
      setNotice('Si un compte existe pour cet e-mail, un lien de réinitialisation vient d’être envoyé.');
    } catch {
      setError('Envoi impossible. Réessayez.');
    } finally {
      requestPending.current = false;
      setStatus('idle');
    }
  };


  const liveMessage =
    status === 'submitting'
      ? isRegistration ? 'Création du compte en cours.' : 'Connexion en cours.'
      : status === 'resetting'
        ? 'Envoi du lien de réinitialisation.'
        : status === 'success'
          ? isRegistration ? 'Compte créé.' : 'Connexion réussie. Redirection en cours.'
          : '';

  const passwordDescribedBy = fieldErrors.password
    ? 'cd-err-password'
    : isRegistration
      ? 'cd-password-hint'
      : undefined;

  return (
    <main lang="fr" className={`cd-login`}>
      <LoginStyles />
      <BrandPanel portal={portal} />
      <section className="cd-access" aria-label="Connexion ClickDrive">
        <div className="cd-topbar">
          <BrandLogo />
          <Link href="/" className="cd-back" aria-label="Retour au site">
            <ArrowLeft aria-hidden="true" />
            <span>Retour au site</span>
          </Link>
        </div>

        {/* Mobile / tablette : rappel compact du message de marque */}
        <div className="cd-mobile-hero" aria-hidden="true">
          <p className="cd-mobile-hero-eyebrow">{copy.eyebrow}</p>
          <p className="cd-mobile-hero-title">
            {copy.title} <span>{copy.titleAccent}</span>
          </p>
        </div>

        <div className="cd-form-content">
          <div className="cd-card">
            {portal !== 'admin' && (
              <nav className="cd-portal-tabs" aria-label="Type de compte">
                <Link
                  href={loginUrl('client')}
                  className="cd-portal-tab"
                  aria-current={portal === 'client' ? 'page' : undefined}
                >
                  <UserRound aria-hidden="true" />
                  Client
                </Link>
                <Link
                  href={loginUrl('agency')}
                  className="cd-portal-tab"
                  aria-current={portal === 'agency' ? 'page' : undefined}
                >
                  <Building2 aria-hidden="true" />
                  <span>
                    Agence<span className="cd-tab-extra"> partenaire</span>
                  </span>
                </Link>
              </nav>
            )}
            {portal === 'admin' && (
              <div className="cd-admin-note">
                <span>
                  <ShieldCheck aria-hidden="true" />
                  Accès réservé — administration
                </span>
                <Link href={loginUrl('client')}>Espace client</Link>
              </div>
            )}

            <header className="cd-form-header">
              <h1>{isRegistration ? 'Créer un compte client' : 'Connexion'}</h1>
              <p>{isRegistration ? 'Créez votre espace pour suivre vos demandes et réservations.' : copy.formSubtitle}</p>
            </header>

            {error && (
              <div role="alert" className="cd-alert">
                <AlertCircle aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}
            {notice && (
              <div role="status" className="cd-notice">
                <CheckCircle2 aria-hidden="true" />
                <p>{notice}</p>
              </div>
            )}

            <form className="cd-form" noValidate onSubmit={handleSubmit} aria-busy={busy}>
              {isRegistration && (
                <div className="cd-field">
                  <label htmlFor="cd-login-name">Nom complet</label>
                  <div className="cd-input-wrap">
                    <UserRound aria-hidden="true" className="cd-input-icon" />
                    <input
                      ref={nameRef}
                      id="cd-login-name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={120}
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value);
                        setFieldErrors((current) => ({ ...current, name: undefined }));
                      }}
                      placeholder="Votre nom"
                      disabled={busy}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? 'cd-err-name' : undefined}
                      className="cd-input"
                    />
                  </div>
                  {fieldErrors.name && <p id="cd-err-name" className="cd-field-error">{fieldErrors.name}</p>}
                </div>
              )}

              <div className="cd-field">
                <label htmlFor="cd-login-email">{copy.emailLabel}</label>
                <div className="cd-input-wrap">
                  <Mail aria-hidden="true" className="cd-input-icon" />
                  <input
                    ref={emailRef}
                    id="cd-login-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete={isRegistration ? 'email' : 'username'}
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors((c) => ({ ...c, email: undefined }));
                    }}
                    placeholder={copy.emailPlaceholder}
                    disabled={busy}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'cd-err-email' : undefined}
                    className="cd-input"
                  />
                </div>
                {fieldErrors.email && <p id="cd-err-email" className="cd-field-error">{fieldErrors.email}</p>}
              </div>

              <div className="cd-field">
                {portal !== 'admin' && !isRegistration ? (
                  <div className="cd-label-row">
                    <label htmlFor="cd-login-password">Mot de passe</label>
                    <button type="button" className="cd-link-btn" onClick={handleForgotPassword} disabled={busy || locked}>
                      {status === 'resetting' ? 'Envoi…' : 'Mot de passe oublié ?'}
                    </button>
                  </div>
                ) : (
                  <label htmlFor="cd-login-password">Mot de passe</label>
                )}
                <div className="cd-input-wrap">
                  <LockKeyhole aria-hidden="true" className="cd-input-icon" />
                  <input
                    ref={passwordRef}
                    id="cd-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegistration ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((c) => ({ ...c, password: undefined }));
                    }}
                    onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLock(false)}
                    placeholder="Votre mot de passe"
                    disabled={busy}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={passwordDescribedBy}
                    className="cd-input cd-input-password"
                  />
                  <button
                    type="button"
                    className="cd-toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={busy}
                    aria-controls="cd-login-password"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
                {fieldErrors.password && <p id="cd-err-password" className="cd-field-error">{fieldErrors.password}</p>}
                {isRegistration && !fieldErrors.password && (
                  <p id="cd-password-hint" className="cd-hint">
                    {MIN_PASSWORD_LENGTH} caractères minimum.
                  </p>
                )}
                {capsLock && <p className="cd-caps-hint">Verrouillage majuscules activé.</p>}
              </div>

              {isRegistration && (
                <div className="cd-field">
                  <label htmlFor="cd-password-confirmation">Confirmer le mot de passe</label>
                  <div className="cd-input-wrap">
                    <LockKeyhole aria-hidden="true" className="cd-input-icon" />
                    <input
                      ref={passwordConfirmationRef}
                      id="cd-password-confirmation"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={passwordConfirmation}
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value);
                        setFieldErrors((current) => ({ ...current, passwordConfirmation: undefined }));
                      }}
                      placeholder="Confirmez votre mot de passe"
                      disabled={busy}
                      aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
                      aria-describedby={fieldErrors.passwordConfirmation ? 'cd-err-confirmation' : undefined}
                      className="cd-input"
                    />
                  </div>
                  {fieldErrors.passwordConfirmation && (
                    <p id="cd-err-confirmation" className="cd-field-error">{fieldErrors.passwordConfirmation}</p>
                  )}
                </div>
              )}

              <button type="submit" className="cd-submit" disabled={busy || locked} data-success={status === 'success'}>
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="cd-spinner" aria-hidden="true" />
                    {isRegistration ? 'Création…' : 'Connexion…'}
                  </>
                ) : status === 'success' ? (
                  <>
                    <Check aria-hidden="true" />
                    {isRegistration ? 'Compte créé' : 'Connexion réussie'}
                  </>
                ) : locked ? (
                  <>Réessayer dans {lockLeft} s</>
                ) : (
                  <>
                    {isRegistration ? 'Créer mon compte' : copy.submitLabel}
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
              {locked && <p className="cd-countdown">Patientez avant une nouvelle tentative.</p>}
              <p className="cd-sr-only" role="status" aria-live="polite">{liveMessage}</p>
            </form>

            {portal === 'client' && (
              <div className="cd-oauth">
                <div className="cd-oauth-divider">ou</div>
                <GoogleSignInButton variant="light" next={redirectUrl} label="Continuer avec Google" />
              </div>
            )}

            {portal === 'client' && (
              <p className="cd-join">
                {isRegistration ? 'Vous avez déjà un compte ? ' : 'Nouveau sur ClickDrive ? '}
                <Link href={isRegistration ? loginUrl('client') : `${LOGIN_PATH}?portal=client&mode=signup`}>
                  {isRegistration ? 'Se connecter' : 'Créer un compte'}
                </Link>
              </p>
            )}

            {portal === 'agency' && (
              <p className="cd-join">
                Pas encore partenaire ? <Link href="/agency/join">Rejoindre le réseau</Link>
              </p>
            )}
          </div>

          <div className="cd-trust">
            <ShieldCheck aria-hidden="true" />
            <p>{copy.trust}</p>
          </div>
          <details className="cd-help">
            <summary>
              Un problème d’accès ?
              <ChevronDown aria-hidden="true" />
            </summary>
            <p>{copy.help}</p>
          </details>
        </div>

        <p className="cd-access-footer">© {new Date().getFullYear()} ClickDrive · Nador, Maroc</p>
      </section>
    </main>
  );
}

function LoginFallback() {
  return (
    <main className={`cd-login`}>
      <LoginStyles />
      <div className="cd-access" style={{ gridColumn: '1 / -1', minHeight: '100svh' }} aria-hidden="true">
        <div className="cd-form-content">
          <div className="cd-skeleton-label" />
          <div className="cd-skeleton" />
        </div>
      </div>
    </main>
  );
}

export default function UnifiedPortalLogin() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <PortalLoginForm />
    </Suspense>
  );
}