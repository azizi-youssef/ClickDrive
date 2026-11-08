import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { validate } from '../middleware/validate.middleware';
import { bookingSchema, bookingStatusSchema } from '../validations/booking.schema';
import { isVehicleAvailable, findSameModelAlternatives } from '../availability/engine';

export const bookingsRouter = Router();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase non configuré dans le backend Express.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function qs(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val as string | undefined;
}

/** GET /api/bookings */
bookingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const agencyId = qs(req.query.agencyId);

    let query = supabase
      .from('bookings')
      .select('*, vehicle:vehicles(id, brand, model, slug), agency:agencies(id, name, slug)')
      .order('created_at', { ascending: false });

    if (agencyId) query = query.eq('agency_id', agencyId);

    const { data, error } = await query;
    if (error) { res.status(500).json({ success: false, error: error.message }); return; }

    const bookings = data ?? [];
    res.json({ success: true, data: bookings, meta: { total: bookings.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Erreur serveur' });
  }
});

/** GET /api/bookings/:id */
bookingsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookings')
      .select('*, vehicle:vehicles(*), agency:agencies(*)')
      .or(`id.eq.${req.params.id},reference.eq.${req.params.id},booking_ref.eq.${req.params.id}`)
      .maybeSingle();

    if (error) { res.status(500).json({ success: false, error: error.message }); return; }
    if (!data) { res.status(404).json({ success: false, error: 'Réservation introuvable' }); return; }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Erreur serveur' });
  }
});

/** POST /api/bookings */
bookingsRouter.post('/', validate(bookingSchema), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const input = req.body;

    // Vérifier que le véhicule existe
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', input.vehicleId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      res.status(404).json({ success: false, error: 'Véhicule introuvable' });
      return;
    }

    // Vérifier la disponibilité
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id, vehicle_id, start_date, end_date, status')
      .eq('vehicle_id', input.vehicleId);

    const allBookings = (existingBookings ?? []) as any[];
    if (!isVehicleAvailable(vehicle, allBookings, input.startDate, input.endDate)) {
      const { data: allVehicles } = await supabase.from('vehicles').select('*').eq('published', true);
      const alternatives = findSameModelAlternatives({
        currentVehicle: vehicle,
        allVehicles: (allVehicles ?? []) as any[],
        allBookings,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      res.status(409).json({
        success: false,
        error: 'Véhicule non disponible pour ces dates',
        alternatives: alternatives.slice(0, 3),
      });
      return;
    }

    const totalDays = Math.max(
      1,
      Math.ceil(
        (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const ref = `CD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        reference: ref,
        booking_ref: ref,
        vehicle_id: input.vehicleId,
        agency_id: input.agencyId,
        customer_name: input.customerName || `${input.firstName || ''} ${input.lastName || ''}`.trim(),
        customer_email: input.customerEmail || input.email || 'client@clickdrive.ma',
        customer_phone: input.customerPhone || input.phone,
        first_name: input.firstName,
        last_name: input.lastName,
        cin: input.cin,
        start_date: input.startDate,
        end_date: input.endDate,
        pickup_time: input.pickupTime ?? '10:00',
        dropoff_time: input.dropoffTime ?? '10:00',
        pickup_location: input.pickupLocation,
        dropoff_location: input.dropoffLocation,
        total_days: totalDays,
        daily_price: vehicle.daily_price,
        total_price: vehicle.daily_price * totalDays,
        deposit_amount: vehicle.deposit || 3000,
        commission_rate: 15,
        status: 'REQUESTED',
        commission_status: 'PENDING',
        requested_at: new Date().toISOString(),
        notes: input.notes || input.customerNotes,
      })
      .select('*, vehicle:vehicles(*), agency:agencies(*)')
      .single();

    if (insertError) {
      res.status(500).json({ success: false, error: insertError.message });
      return;
    }

    res.status(201).json({ success: true, data: booking });
  } catch (err: any) {
    console.error('[Booking Create Error]', err);
    res.status(500).json({ success: false, error: err.message ?? 'Erreur lors de la création de la réservation' });
  }
});

/** PATCH /api/bookings/:id/status */
bookingsRouter.patch('/:id/status', validate(bookingStatusSchema), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { status, rejectionReason } = req.body;

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status,
        rejection_reason: rejectionReason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) { res.status(404).json({ success: false, error: error.message }); return; }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Erreur serveur' });
  }
});
