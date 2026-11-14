import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeVehicleKindFields, onlyProvidedFields, vehicleKindIssues, vehicleUpdateSchema, type VehicleUpdateInput } from '@/lib/validations/vehicle';
import { vehicleTypeOf } from '@/lib/vehicles/kind';
import { isMotorcycleSchemaMissing, MOTORCYCLE_SCHEMA_MISSING_MESSAGE } from '@/lib/vehicles/schema-support';
import { protectedFieldChanges, violationResponseInit } from '@/lib/vehicles/protected-fields';

type RouteContext = { params: Promise<{ id: string; vehicleId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: agencyId, vehicleId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select(
      '*, images:vehicle_images(id, url, is_primary, display_order), features:vehicle_features(id, name)'
    )
    .eq('id', vehicleId)
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (error) {
    console.error('[AgencyVehicle] Get error:', error.message);
    return failure('Impossible de charger le véhicule.', 500);
  }
  if (!vehicle) {
    return failure('Véhicule introuvable.', 404);
  }

  // Trier les images
  const rawImages = (vehicle.images ?? []) as any[];
  rawImages.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  // Récupérer les réservations récentes/à venir
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, reference, customer_name, start_date, end_date, status, total_price')
    .eq('vehicle_id', vehicleId)
    .eq('agency_id', agencyId)
    .order('start_date', { ascending: false })
    .limit(10);

  return NextResponse.json({
    success: true,
    data: {
      ...vehicle,
      images: rawImages.map((img) => img.url),
      features: ((vehicle.features ?? []) as any[]).map((f) => f.name),
      upcoming_bookings: bookings ?? [],
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: agencyId, vehicleId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.manage');
  if (gate.denied) return gate.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure('Corps de requête JSON invalide.', 400);
  }

  const parsed = vehicleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return failure(
      parsed.error.issues.map((i) => i.message).join(', '),
      422
    );
  }

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  // Vérifier l'appartenance (toutes les colonnes : nécessaires au contrôle type / catégorie)
  // Un véhicule archivé (retiré de la flotte) n'est plus modifiable
  const { data: existing, error: existError } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .eq('agency_id', agencyId)
    .is('archived_at', null)
    .maybeSingle();

  if (existError) {
    console.error('[AgencyVehicle] Ownership lookup error:', existError.message);
    return failure('Impossible de vérifier ce véhicule.', 500);
  }
  if (!existing) {
    return failure('Véhicule introuvable pour cette agence.', 404);
  }

  // Le formulaire renvoie la ligne complète : id, agency_id, featured… sont tolérés inchangés, jamais modifiés
  const violations = protectedFieldChanges(body, existing as Record<string, unknown>);
  if (violations.length > 0) {
    const { status, message } = violationResponseInit(violations);
    return failure(message, status);
  }

  // Mise à jour partielle : seuls les champs réellement envoyés sont pris en compte
  // (le schéma applique sinon ses valeurs par défaut, ce qui effaçait photos et équipements
  // lors d'une simple publication / dépublication).
  const provided = new Set(body && typeof body === 'object' ? Object.keys(body as Record<string, unknown>) : []);
  const input: VehicleUpdateInput = onlyProvidedFields(parsed.data, body);

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  // Type de véhicule (voiture / moto) : contrôle de cohérence sur l'état fusionné
  const kindKeys = ['vehicle_type', 'category', 'seats', 'doors', 'engine_cc', 'license_required'] as const;
  if (kindKeys.some((key) => provided.has(key))) {
    const schemaSupportsMotorcycles = 'vehicle_type' in existing;
    const merged = normalizeVehicleKindFields({
      vehicle_type: input.vehicle_type ?? vehicleTypeOf(existing),
      category: input.category ?? existing.category,
      seats: input.seats ?? existing.seats,
      doors: input.doors ?? existing.doors,
      air_conditioning: input.air_conditioning ?? existing.air_conditioning,
      engine_cc: provided.has('engine_cc') ? input.engine_cc ?? null : existing.engine_cc ?? null,
      license_required: provided.has('license_required') ? input.license_required ?? null : existing.license_required ?? null,
    });
    const issues = vehicleKindIssues(merged);
    if (issues.length > 0) return failure(issues.join(' '), 422);
    if (merged.vehicle_type === 'MOTORCYCLE' && !schemaSupportsMotorcycles) {
      return failure(MOTORCYCLE_SCHEMA_MISSING_MESSAGE, 503);
    }
    if (schemaSupportsMotorcycles) {
      updateData.vehicle_type = merged.vehicle_type;
      updateData.engine_cc = merged.engine_cc ?? null;
      updateData.license_required = merged.license_required ?? null;
    }
    if (merged.vehicle_type === 'MOTORCYCLE') {
      input.doors = merged.doors ?? 0;
      input.air_conditioning = false;
    }
  }

  if (input.brand !== undefined) updateData.brand = input.brand;
  if (input.model !== undefined) updateData.model = input.model;
  if (input.year !== undefined) updateData.year = input.year;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.transmission !== undefined) updateData.transmission = input.transmission;
  if (input.fuel !== undefined) updateData.fuel = input.fuel;
  if (input.seats !== undefined) updateData.seats = input.seats;
  if (input.doors !== undefined) updateData.doors = input.doors;
  if (input.air_conditioning !== undefined) updateData.air_conditioning = input.air_conditioning;
  if (input.mileage !== undefined) updateData.mileage = input.mileage;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.insurance_coverage !== undefined) updateData.insurance_coverage = input.insurance_coverage ?? null;
  if (input.insurance_excess !== undefined) updateData.insurance_excess = input.insurance_excess ?? null;
  if (input.daily_price !== undefined) updateData.daily_price = input.daily_price;
  if (input.weekly_price !== undefined) updateData.weekly_price = input.weekly_price;
  if (input.monthly_price !== undefined) updateData.monthly_price = input.monthly_price;
  if (input.deposit !== undefined) updateData.deposit = input.deposit;
  if (input.min_rental_days !== undefined) updateData.min_rental_days = input.min_rental_days;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.published !== undefined) updateData.published = input.published;
  if (input.license_plate !== undefined) updateData.license_plate = input.license_plate;
  if (input.unit_number !== undefined) updateData.unit_number = input.unit_number;

  const { data: updated, error: updateError } = await supabase
    .from('vehicles')
    .update(updateData)
    .eq('id', vehicleId)
    .eq('agency_id', agencyId)
    .select()
    .single();

  if (updateError) {
    console.error('[AgencyVehicle] Update error:', updateError.code, updateError.message);
    if (isMotorcycleSchemaMissing(updateError)) return failure(MOTORCYCLE_SCHEMA_MISSING_MESSAGE, 503);
    if (updateError.code === 'PGRST116') return failure('Véhicule introuvable pour cette agence.', 404);
    return failure('Le véhicule n’a pas pu être mis à jour. Réessayez dans un instant.', 500);
  }

  // Si des images sont fournies dans l'update, remplacer la table vehicle_images
  if (input.images !== undefined) {
    const { error: imagesDeleteError } = await supabase.from('vehicle_images').delete().eq('vehicle_id', vehicleId);
    const { error: imagesInsertError } =
      !imagesDeleteError && input.images.length > 0
        ? await supabase.from('vehicle_images').insert(
            input.images.map((url, idx) => ({
              vehicle_id: vehicleId,
              url,
              is_primary: idx === 0,
              display_order: idx,
            }))
          )
        : { error: null };
    if (imagesDeleteError || imagesInsertError) {
      console.error('[AgencyVehicle] Images not saved:', (imagesDeleteError ?? imagesInsertError)?.message);
      return failure('Le véhicule a été mis à jour, mais ses photos n’ont pas pu être enregistrées. Réessayez.', 500);
    }
  }

  // Si des équipements sont fournis dans l'update, remplacer vehicle_features
  if (input.features !== undefined) {
    const { error: featuresDeleteError } = await supabase.from('vehicle_features').delete().eq('vehicle_id', vehicleId);
    const { error: featuresInsertError } =
      !featuresDeleteError && input.features.length > 0
        ? await supabase.from('vehicle_features').insert(input.features.map((name) => ({ vehicle_id: vehicleId, name })))
        : { error: null };
    if (featuresDeleteError || featuresInsertError) {
      console.error('[AgencyVehicle] Features not saved:', (featuresDeleteError ?? featuresInsertError)?.message);
      return failure('Le véhicule a été mis à jour, mais ses équipements n’ont pas pu être enregistrés. Réessayez.', 500);
    }
  }

  return NextResponse.json({
    success: true,
    data: updated,
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: agencyId, vehicleId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.manage');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  // Vérifier si le véhicule existe
  const { data: vehicle, error: fetchErr } = await supabase
    .from('vehicles')
    .select('id, brand, model')
    .eq('id', vehicleId)
    .eq('agency_id', agencyId)
    .is('archived_at', null)
    .maybeSingle();

  if (fetchErr || !vehicle) {
    return failure('Véhicule introuvable.', 404);
  }

  // Vérifier si des réservations existent pour ce véhicule
  const { count, error: countErr } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_id', vehicleId);

  if (countErr) {
    return failure('Erreur lors de la vérification des réservations existantes.', 500);
  }

  if (count && count > 0) {
    // Ne pas supprimer un véhicule ayant un historique de réservation (préserver l'historique financier et client)
    // On le dépublie et bascule son statut à BLOCKED
    // Archivé : il sort de la flotte et ne compte plus dans la capacité de la formule
    const nowIso = new Date().toISOString();
    const { error: archiveError } = await supabase
      .from('vehicles')
      .update({
        published: false,
        status: 'BLOCKED',
        archived_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', vehicleId)
      .eq('agency_id', agencyId);
    if (archiveError) {
      console.error('[AgencyVehicle] Unpublish error:', archiveError.message);
      return failure('Le véhicule n’a pas pu être retiré du catalogue. Réessayez dans un instant.', 500);
    }

    return NextResponse.json({
      success: true,
      message: 'Le véhicule possède des réservations associées. Il a été dépublié et retiré de la disponibilité active plutôt que supprimé de façon destructive.',
      archived: true,
    });
  }

  // Si aucune réservation, suppression complète
  const { error: delErr } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)
    .eq('agency_id', agencyId);

  if (delErr) {
    console.error('[AgencyVehicle] Delete error:', delErr.message);
    return failure('Le véhicule n’a pas pu être supprimé. Réessayez dans un instant.', 500);
  }

  return NextResponse.json({
    success: true,
    message: 'Véhicule supprimé avec succès.',
  });
}
