-- ========================================================================
-- ClickDrive: Realistic Seed Data for Nador (10 Agencies, 50+ Vehicles)
-- ========================================================================

-- Insert 10 Realistic Rental Agencies in Nador
INSERT INTO public.agencies (id, name, slug, description, phone, whatsapp, email, address, city, latitude, longitude, logo_url, banner_url, status, verified, rating, review_count)
VALUES
('a0000000-0000-0000-0000-000000000001', 'Nador Auto Rent', 'nador-auto-rent', 'Agence leader au centre-ville de Nador. Flotte récente, livraison gratuite à l''aéroport Al-Aroui.', '+212536601122', '+212661234567', 'contact@nadorautorent.ma', 'Boulevard Mohammed V, Centre-ville, Nador', 'Nador', 35.1740, -2.9287, 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.92, 128),
('a0000000-0000-0000-0000-000000000002', 'Rif Car Luxury', 'rif-car-luxury', 'Spécialiste des SUV premium et berlines de prestige à Nador et dans l''Oriental.', '+212536603344', '+212662345678', 'reservation@rifcarluxury.ma', 'Avenue des FAR, Nador', 'Nador', 35.1712, -2.9331, 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.88, 94),
('a0000000-0000-0000-0000-000000000003', 'Marchica Drive', 'marchica-drive', 'Service de location premium situé sur la corniche Marchica. Véhicules neufs et service VIP.', '+212536605566', '+212663456789', 'info@marchicadrive.com', 'Corniche de Nador, Marchica Med, Nador', 'Nador', 35.1802, -2.9210, 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.95, 112),
('a0000000-0000-0000-0000-000000000004', 'Aéroport Nador Cars', 'aeroport-nador-cars', 'Comptoir 7j/7 directement devant le hall des arrivées de l''aéroport Nador Al-Aroui.', '+212536607788', '+212664567890', 'contact@aeroportnadorcars.ma', 'Hall des arrivées, Aéroport Nador Al-Aroui', 'Al-Aroui', 34.9886, -3.0283, 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.79, 165),
('a0000000-0000-0000-0000-000000000005', 'Selouane Mobility', 'selouane-mobility', 'Location économique et utilitaire pour professionnels et particuliers à Selouane et Nador.', '+212536358899', '+212665678901', 'contact@selouanemobility.ma', 'Boulevard Principal, Selouane', 'Selouane', 35.0743, -2.9998, 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.72, 58),
('a0000000-0000-0000-0000-000000000006', 'Beni Ansar Rent', 'beni-ansar-rent', 'Prise en charge directe à la sortie du Port de Beni Ansar pour les arrivées par bateau.', '+212536341234', '+212666789012', 'contact@beniansarrent.ma', 'Gare Maritime, Port de Beni Ansar, Nador', 'Beni Ansar', 35.2632, -2.9376, 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.85, 87),
('a0000000-0000-0000-0000-000000000007', 'Atlas Car Nador', 'atlas-car-nador', 'Prix compétitifs, conditions souples et véhicules parfaitement entretenus.', '+212536608901', '+212667890123', 'contact@atlascarnador.com', 'Avenue Hassan II, Quartier Lamatare, Nador', 'Nador', 35.1650, -2.9390, 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.68, 43),
('a0000000-0000-0000-0000-000000000008', 'Al Aroui Express Drive', 'al-aroui-express-drive', 'Service rapide et navette directe pour voyageurs et familles de passage dans l''Oriental.', '+212536367890', '+212668901234', 'resa@alarouidrive.ma', 'Route Nationale 19, Al-Aroui', 'Al-Aroui', 34.9812, -3.0150, 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.75, 52),
('a0000000-0000-0000-0000-000000000009', 'Méditerranée Car', 'mediterranee-car', 'Agence familiale réputée pour sa fiabilité et sa ponctualité à Nador.', '+212536609911', '+212669012345', 'service@mediterraneecar.ma', 'Rue Youssef Ibn Tachfine, Nador', 'Nador', 35.1765, -2.9315, 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.82, 64),
('a0000000-0000-0000-0000-000000000010', 'MRE Express Car', 'mre-express-car', 'Partenaire privilégié des résidents marocains à l''étranger. Assistance 24/7 et contrats bilingues.', '+212536604455', '+212660123456', 'support@mreexpresscar.ma', 'Boulevard El Amir Sidi Mohamed, Nador', 'Nador', 35.1695, -2.9348, 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&auto=format&fit=crop&q=80', 'ACTIVE', true, 4.91, 140)
ON CONFLICT (id) DO NOTHING;

-- Insert Vehicles (Sample of primary units across multiple agencies for cross-matching)
INSERT INTO public.vehicles (id, agency_id, unit_number, license_plate, brand, model, slug, year, category, transmission, fuel, seats, doors, air_conditioning, mileage, daily_price, deposit, status, published, featured)
VALUES
-- Duster cross-agency demonstration (Crucial for the user requirement: when Duster is unavailable at one, show others)
('v0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Duster #001', '41203-A-50', 'Dacia', 'Duster', 'dacia-duster-2025-nador-auto-rent-01', 2025, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 5, true, 12000, 360.00, 3000.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Duster #002', '58192-B-50', 'Dacia', 'Duster', 'dacia-duster-2024-rif-luxury-02', 2024, 'SUV', 'MANUAL', 'DIESEL', 5, 5, true, 24000, 340.00, 3000.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Duster #003', '61439-A-50', 'Dacia', 'Duster', 'dacia-duster-2025-marchica-03', 2025, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 5, true, 8000, 380.00, 3500.00, 'AVAILABLE', true, false),
('v0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Duster #004', '73021-H-50', 'Dacia', 'Duster', 'dacia-duster-2024-aeroport-04', 2024, 'SUV', 'MANUAL', 'DIESEL', 5, 5, true, 31000, 330.00, 2500.00, 'AVAILABLE', true, false),

-- Clio 5 cross-agency
('v0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Clio #001', '12940-A-50', 'Renault', 'Clio 5', 'renault-clio-5-2024-nador-auto-rent', 2024, 'Économique', 'MANUAL', 'DIESEL', 5, 5, true, 19000, 280.00, 2500.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 'Clio #002', '34102-D-50', 'Renault', 'Clio 5', 'renault-clio-5-2025-atlas-car', 2025, 'Économique', 'AUTOMATIC', 'DIESEL', 5, 5, true, 9500, 320.00, 3000.00, 'AVAILABLE', true, false),
('v0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000010', 'Clio #003', '49821-A-50', 'Renault', 'Clio 5', 'renault-clio-5-2024-mre-express', 2024, 'Économique', 'MANUAL', 'DIESEL', 5, 5, true, 26000, 270.00, 2500.00, 'AVAILABLE', true, false),

-- Sandero Stepway
('v0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000005', 'Sandero #001', '18234-A-50', 'Dacia', 'Sandero Stepway', 'dacia-sandero-stepway-2024-selouane', 2024, 'Économique', 'MANUAL', 'DIESEL', 5, 5, true, 14000, 260.00, 2500.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000006', 'Sandero #002', '62914-C-50', 'Dacia', 'Sandero Stepway', 'dacia-sandero-stepway-2025-beni-ansar', 2025, 'Économique', 'AUTOMATIC', 'DIESEL', 5, 5, true, 11000, 300.00, 2500.00, 'AVAILABLE', true, false),

-- Golf 8 & T-Roc
('v0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'Golf8 #001', '83021-A-50', 'Volkswagen', 'Golf 8', 'volkswagen-golf-8-2024-rif-luxury', 2024, 'Berline', 'AUTOMATIC', 'DIESEL', 5, 5, true, 22000, 680.00, 5000.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', 'T-Roc #001', '94012-A-50', 'Volkswagen', 'T-Roc', 'volkswagen-t-roc-2025-marchica', 2025, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 5, true, 7500, 620.00, 4500.00, 'AVAILABLE', true, true),

-- Hyundai Tucson & Kia Sportage
('v0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000004', 'Tucson #001', '71049-A-50', 'Hyundai', 'Tucson', 'hyundai-tucson-2024-aeroport', 2024, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 5, true, 28000, 690.00, 5000.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000008', 'Sportage #001', '52938-A-50', 'Kia', 'Sportage', 'kia-sportage-2024-al-aroui', 2024, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 5, true, 19500, 670.00, 5000.00, 'AVAILABLE', true, false),

-- Luxury: Range Rover Evoque & Mercedes Classe A
('v0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002', 'Evoque #001', '99120-A-50', 'Land Rover', 'Range Rover Evoque', 'range-rover-evoque-2024-rif-luxury', 2024, 'Luxe', 'AUTOMATIC', 'DIESEL', 5, 5, true, 16000, 1450.00, 10000.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000003', 'ClasseA #001', '88102-B-50', 'Mercedes-Benz', 'Classe A', 'mercedes-benz-classe-a-2025-marchica', 2025, 'Luxe', 'AUTOMATIC', 'DIESEL', 5, 5, true, 8900, 950.00, 8000.00, 'AVAILABLE', true, true),

-- 7 Places: Dacia Jogger & Mercedes Vito
('v0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'Jogger #001', '39102-A-50', 'Dacia', 'Jogger', 'dacia-jogger-7-places-2024-nador-auto', 2024, '7 places', 'MANUAL', 'GASOLINE', 7, 5, true, 21000, 480.00, 3500.00, 'AVAILABLE', true, true),
('v0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000010', 'Vito #001', '28192-A-50', 'Mercedes-Benz', 'Vito Tourer', 'mercedes-benz-vito-9-places-mre-express', 2024, '7 places', 'AUTOMATIC', 'DIESEL', 9, 5, true, 34000, 1100.00, 8000.00, 'AVAILABLE', true, true)
ON CONFLICT (id) DO NOTHING;

-- Insert Images
INSERT INTO public.vehicle_images (vehicle_id, url, is_primary, display_order)
VALUES
('v0000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000014', 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80', true, 1),
('v0000000-0000-0000-0000-000000000015', 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&auto=format&fit=crop&q=80', true, 1);

-- Insert Features
INSERT INTO public.vehicle_features (vehicle_id, name)
VALUES
('v0000000-0000-0000-0000-000000000001', 'Apple CarPlay & Android Auto'),
('v0000000-0000-0000-0000-000000000001', 'Caméra de recul'),
('v0000000-0000-0000-0000-000000000001', 'Climatisation Automatique'),
('v0000000-0000-0000-0000-000000000001', 'Régulateur de vitesse'),
('v0000000-0000-0000-0000-000000000002', 'Bluetooth mains-libres'),
('v0000000-0000-0000-0000-000000000002', 'Radar de stationnement arrière'),
('v0000000-0000-0000-0000-000000000005', 'Écran tactile'),
('v0000000-0000-0000-0000-000000000005', 'Consommation basse (4.2L/100km)'),
('v0000000-0000-0000-0000-000000000014', 'Toit ouvrant panoramique'),
('v0000000-0000-0000-0000-000000000014', 'Sièges cuir chauffants'),
('v0000000-0000-0000-0000-000000000014', 'Cockpit virtuel 3D');
