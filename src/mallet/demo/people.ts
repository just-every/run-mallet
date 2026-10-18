// Buckeye Auto Repair's team and customers: invented people on reserved
// example domains. Ids are fixed so a repeated seed writes nothing new.
export const owner = 'Kayla Ortiz'

export const team = [
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c01', email: 'ben@buckeyeauto.example', name: 'Ben Carter', role: 'admin', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c02', email: 'andre@buckeyeauto.example', name: 'Andre Wallace', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c03', email: 'luis@buckeyeauto.example', name: 'Luis Romero', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c04', email: 'mei@buckeyeauto.example', name: 'Mei Lin', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c05', email: 'jake@buckeyeauto.example', name: 'Jake Kowalski', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c06', email: 'chris@buckeyeauto.example', name: 'Chris Novak', role: 'member', status: 'active' },
] as const

export type Who = 'kayla' | 'ben' | 'andre' | 'luis' | 'mei' | 'jake' | 'chris' | 'agent' | 'oldagent'
export const technician = { andre: team[1].id, luis: team[2].id, mei: team[3].id, jake: team[4].id, chris: team[5].id } as const

// Agent preparation keys. Nobody holds their tokens: they only name past work.
export const assistantKey = { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1ca1', label: 'Mallet advisor' }
export const retiredKey = { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1ca2', label: 'Estimate helper (old front-desk laptop)' }

// Fleet accounts: the person who decides on the business's behalf.
export const contacts: Record<string, string> = { 'Buckeye Plumbing': 'Karen Mills', 'Scioto Landscaping': 'Josh Greenhill' }

/** Customer assets: key, customer, email, vehicle and Ohio plate. */
export const assets: [string, string, string, string, string][] = [
  ['crv', 'Dana Brooks', 'dana.brooks@example.com', '2019 Honda CR-V EX', 'OH JKV 4471'],
  ['odyssey', 'Priya Shah', 'priya.shah@example.com', '2013 Honda Odyssey EX-L', 'OH HRT 2290'],
  ['rav4', 'Marcus Hill', 'marcus.hill@example.com', '2021 Toyota RAV4 XLE', 'OH LMB 3318'],
  ['escape', 'Tom Avery', 'tom.avery@example.com', '2015 Ford Escape SE', 'OH FZN 7702'],
  ['f150', 'Buckeye Plumbing', 'fleet@buckeyeplumbing.example', '2017 Ford F-150 XL (Truck 12)', 'OH BPC 0012'],
  ['van7', 'Buckeye Plumbing', 'fleet@buckeyeplumbing.example', '2020 Ford Transit 250 (Van 7)', 'OH BPC 0007'],
  ['van8', 'Buckeye Plumbing', 'fleet@buckeyeplumbing.example', '2020 Ford Transit 250 (Van 8)', 'OH BPC 0008'],
  ['cx5', 'Kevin Liu', 'kevin.liu@example.com', '2020 Mazda CX-5 Touring', 'OH KPD 5521'],
  ['explorer', 'Nina Patel', 'nina.patel@example.com', '2020 Ford Explorer XLT', 'OH JWS 6184'],
  ['equinox', 'Greg Turner', 'greg.turner@example.com', '2016 Chevrolet Equinox LT', 'OH GTR 4407'],
  ['camry', 'Sarah Miller', 'sarah.miller@example.com', '2021 Toyota Camry SE', 'OH LCA 8835'],
  ['telluride', 'Erin Walsh', 'erin.walsh@example.com', '2022 Kia Telluride EX', 'OH LXE 1290'],
  ['model3', 'Evan Torres', 'evan.torres@example.com', '2021 Tesla Model 3 Long Range', 'OH EVT 2021'],
  ['silverado', 'Matt Wilson', 'matt.wilson@example.com', '2019 Chevrolet Silverado 1500 LT', 'OH HMW 3096'],
  ['civic', 'Ashley Park', 'ashley.park@example.com', '2020 Honda Civic EX', 'OH JAP 5530'],
  ['elantra', 'Daniel Kim', 'daniel.kim@example.com', '2022 Hyundai Elantra SEL', 'OH LDK 7148'],
  ['cherokee', 'Monica Ray', 'monica.ray@example.com', '2020 Jeep Grand Cherokee Limited', 'OH JMR 2643'],
  ['bmw', 'Rachel Kim', 'rachel.kim@example.com', '2023 BMW 330i xDrive', 'OH RKB 3300'],
  ['malibu', 'Andrea Lopez', 'andrea.lopez@example.com', '2016 Chevrolet Malibu LT', 'OH GAL 9915'],
  ['accord', 'Brian Foster', 'brian.foster@example.com', '2009 Honda Accord EX', 'OH DBF 4120'],
  ['colorado', 'Scioto Landscaping', 'office@sciotolandscaping.example', '2015 Chevrolet Colorado WT (Truck 3)', 'OH SCL 0003'],
  ['outback', 'Laura Bennett', 'laura.bennett@example.com', '2016 Subaru Outback 2.5i', 'OH GLB 6602'],
  ['corolla', 'Jordan Lee', 'jordan.lee@example.com', '2017 Toyota Corolla LE', 'OH FJL 2817'],
  ['fusion', 'Peter Novak', 'peter.novak@example.com', '2014 Ford Fusion SE', 'OH EPN 3561'],
  ['golf', 'Sophie Martin', 'sophie.martin@example.com', '2015 Volkswagen Golf TSI S', 'OH FSM 3880'],
  // Registered at the counter this week, no visit yet: the one asset an owner may erase.
  ['tacoma', 'Felix Grant', 'felix.grant@example.com', '2008 Toyota Tacoma SR', 'OH CFG 9810'],
]
