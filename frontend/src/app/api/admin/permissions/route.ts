import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { USER_ROLES, type UserRole } from '@clickdrive/shared/roles';
import { z } from 'zod';

const updateRoleSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
  newRole: z.enum(USER_ROLES),
});

export async function GET() {
  const gate = await requirePlatformPermissionApi('members.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
  }

  try {
    // 1. Récupérer les profils avec rôles privilégiés
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select(`
        id, email, full_name, phone, role, avatar_url, created_at, updated_at
      `)
      .order('role', { ascending: true })
      .order('created_at', { ascending: false });

    if (pErr) throw pErr;

    // 2. Récupérer les affiliations d'agences pour enrichir les gestionnaires
    const { data: agencyMembers } = await supabase
      .from('agency_members')
      .select('user_id, role, agency:agencies(id, name, slug)');

    const memberAgencyMap = new Map<string, { id: string; name: string; slug: string }>();
    (agencyMembers || []).forEach((am: any) => {
      if (am.user_id && am.agency) {
        memberAgencyMap.set(am.user_id, am.agency);
      }
    });

    const enrichedUsers = (profiles || []).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name || 'Utilisateur',
      phone: p.phone || '—',
      role: p.role as UserRole,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      agency: memberAgencyMap.get(p.id) || null,
    }));

    // 3. Matrice des permissions complète
    const rbacMatrix = [
      {
        category: 'Administration Plateforme',
        permissions: [
          { name: 'Accès au Dashboard Super Admin', key: 'admin.access', roles: ['SUPER_ADMIN', 'ADMIN'] },
          { name: 'Configuration du taux de commission', key: 'settings.commission', roles: ['SUPER_ADMIN'] },
          { name: 'Gestion des rôles & attributions RBAC', key: 'members.update_role', roles: ['SUPER_ADMIN'] },
          { name: 'Consultation des Audit Logs système', key: 'audit.read', roles: ['SUPER_ADMIN', 'ADMIN'] },
        ],
      },
      {
        category: 'Gestion des Agences',
        permissions: [
          { name: 'Création d’une nouvelle agence', key: 'agencies.create', roles: ['SUPER_ADMIN', 'ADMIN'] },
          { name: 'Validation & vérification d’agence', key: 'agencies.verify', roles: ['SUPER_ADMIN', 'ADMIN'] },
          { name: 'Suspension ou radiation d’agence', key: 'agencies.suspend', roles: ['SUPER_ADMIN'] },
          { name: 'Modification des coordonnées agence', key: 'agencies.update', roles: ['SUPER_ADMIN', 'ADMIN', 'AGENCY_OWNER', 'AGENCY_MANAGER'] },
        ],
      },
      {
        category: 'Flotte & Catalogue Véhicules',
        permissions: [
          { name: 'Voir tous les véhicules marketplace', key: 'vehicles.read_all', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
          { name: 'Ajouter un véhicule à sa flotte', key: 'vehicles.create', roles: ['SUPER_ADMIN', 'AGENCY_OWNER', 'AGENCY_MANAGER'] },
          { name: 'Modifier statut (Disponible, Entretien)', key: 'vehicles.update_status', roles: ['SUPER_ADMIN', 'AGENCY_OWNER', 'AGENCY_MANAGER', 'AGENCY_STAFF'] },
          { name: 'Supprimer un véhicule', key: 'vehicles.delete', roles: ['SUPER_ADMIN', 'AGENCY_OWNER'] },
        ],
      },
      {
        category: 'Réservations & Remises de Clés',
        permissions: [
          { name: 'Consulter toutes les réservations', key: 'bookings.read_all', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
          { name: 'Valider / Refuser une réservation agence', key: 'bookings.manage', roles: ['SUPER_ADMIN', 'AGENCY_OWNER', 'AGENCY_MANAGER'] },
          { name: 'Enregistrer l’état des lieux & départ', key: 'handover.pickup', roles: ['SUPER_ADMIN', 'AGENCY_OWNER', 'AGENCY_MANAGER', 'AGENCY_STAFF'] },
          { name: 'Valider restitution & libération caution', key: 'handover.return', roles: ['SUPER_ADMIN', 'AGENCY_OWNER', 'AGENCY_MANAGER'] },
        ],
      },
      {
        category: 'Clients & Communications',
        permissions: [
          { name: 'Consulter le répertoire clients', key: 'customers.read', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
          { name: 'Diffuser des alertes WhatsApp Business', key: 'notifications.send', roles: ['SUPER_ADMIN', 'ADMIN'] },
          { name: 'Consulter l’historique des messages', key: 'notifications.read', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
        ],
      },
    ];

    const kpis = {
      totalUsers: enrichedUsers.length,
      superAdmins: enrichedUsers.filter((u) => u.role === 'SUPER_ADMIN').length,
      platformAdmins: enrichedUsers.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
      agencyManagers: enrichedUsers.filter((u) => ['AGENCY_OWNER', 'AGENCY_MANAGER', 'AGENCY_STAFF'].includes(u.role)).length,
      customers: enrichedUsers.filter((u) => u.role === 'CUSTOMER').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        rbacMatrix,
        kpis,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur chargement permissions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePlatformPermissionApi('members.update_role');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { userId, newRole } = parsed.data;

    // Ne pas rétrograder le super admin actuel si c'est lui-même
    if (userId === gate.auth.userId && newRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas révoquer vos propres privilèges de Super Admin.' },
        { status: 400 }
      );
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updErr) throw updErr;

    // Audit log de modification de rôle
    await supabase.from('audit_logs').insert({
      action: 'USER_ROLE_UPDATED',
      entity_type: 'user_profile',
      entity_id: userId,
      user_id: gate.auth.userId,
      metadata: {
        updatedUserId: userId,
        newRole,
        performedBy: gate.auth.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Rôle mis à jour avec succès : ${newRole}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur mise à jour du rôle';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
