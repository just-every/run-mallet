// Corella Street Mechanical's team and customers: invented people on reserved
// example domains. Ids are fixed so a repeated seed writes nothing new.
export const owner = 'Dana Whitfield'

export const team = [
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c01', email: 'priya@corellamechanical.example', name: 'Priya Nair', role: 'admin', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c02', email: 'tom@corellamechanical.example', name: 'Tom Becker', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c03', email: 'luis@corellamechanical.example', name: 'Luis Ortega', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c04', email: 'mia@corellamechanical.example', name: 'Mia Tran', role: 'member', status: 'active' },
  { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1c05', email: 'ken@corellamechanical.example', name: 'Ken Ashby', role: 'member', status: 'active' },
] as const

export type Who = 'dana' | 'priya' | 'tom' | 'luis' | 'mia' | 'ken' | 'agent' | 'oldagent'
export const technician = { tom: team[1].id, luis: team[2].id, mia: team[3].id, ken: team[4].id } as const

// Agent preparation keys. Nobody holds their tokens: they only name past work.
export const assistantKey = { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1ca1', label: 'Workshop assistant' }
export const retiredKey = { id: '3f6b2c1e-8d4a-4b7e-9c21-5a0d7e4b1ca2', label: 'Estimate helper (old front-desk laptop)' }

// Fleet accounts: the person who decides on the business's behalf.
export const contacts: Record<string, string> = { 'Bayside Plumbing': 'Karen Mills', 'Greenhill Landscaping': 'Josh Greenhill' }

/** Customer assets: key, customer, email, vehicle and registration. */
export const assets: [string, string, string, string, string][] = [
  ['corolla', 'Jordan Lee', 'jordan.lee@example.com', '2017 Toyota Corolla Ascent', '512 KXD'],
  ['cx5', 'Aisha Rahman', 'aisha.rahman@example.com', '2019 Mazda CX-5 Maxx Sport', '804 JTR'],
  ['hiace1', 'Bayside Plumbing', 'accounts@baysideplumbing.example', '2020 Toyota HiAce LWB van (van 1)', 'BPL 101'],
  ['hiace2', 'Bayside Plumbing', 'accounts@baysideplumbing.example', '2020 Toyota HiAce LWB van (van 2)', 'BPL 102'],
  ['ranger-xl', 'Bayside Plumbing', 'accounts@baysideplumbing.example', '2018 Ford Ranger XL tray', 'BPL 103'],
  ['forester', 'Grace Whitaker', 'grace.whitaker@example.com', '2012 Subaru Forester XS', '271 HNB'],
  ['commodore', 'Daniel Okafor', 'daniel.okafor@example.com', '2016 Holden Commodore SV6', '633 GWE'],
  ['cerato', 'Mei Lin Chen', 'meilin.chen@example.com', '2021 Kia Cerato Sport', '150 LQA'],
  ['prado', "Liam O'Connor", 'liam.oconnor@example.com', '2010 Toyota LandCruiser Prado GXL', '947 FMS'],
  ['golf', 'Sophie Martin', 'sophie.martin@example.com', '2015 Volkswagen Golf 90TSI', '388 HUK'],
  ['i30', 'Raj Patel', 'raj.patel@example.com', '2018 Hyundai i30 Active', '722 JDP'],
  ['lancer', 'Hannah Brooks', 'hannah.brooks@example.com', '2014 Mitsubishi Lancer ES', '019 GCZ'],
  ['wildtrak', 'Ethan Walsh', 'ethan.walsh@example.com', '2019 Ford Ranger Wildtrak', '561 JZF'],
  ['jazz', 'Chloe Nguyen', 'chloe.nguyen@example.com', '2019 Honda Jazz VTi', '295 KAB'],
  ['navara', 'Marcus Doyle', 'marcus.doyle@example.com', '2013 Nissan Navara D40 ST', '846 FXR'],
  ['rav4', 'Olivia Hart', 'olivia.hart@example.com', '2022 Toyota RAV4 Hybrid GX', '403 LMV'],
  ['mazda3', 'Ben Carter', 'ben.carter@example.com', '2011 Mazda3 Neo', '177 EWT'],
  ['swift', 'Isla Fraser', 'isla.fraser@example.com', '2017 Suzuki Swift GL Navigator', '660 HZS'],
  ['outback', 'Noah Kim', 'noah.kim@example.com', '2016 Subaru Outback 2.5i', '238 GPL'],
  ['dmax', 'Greenhill Landscaping', 'office@greenhilllandscaping.example', '2015 Isuzu D-Max SX tray', 'GHL 015'],
  ['accord', 'Ruby Sinclair', 'ruby.sinclair@example.com', '2009 Honda Accord Euro', '590 DQK'],
  ['triton', 'Sam Delaney', 'sam.delaney@example.com', '2018 Mitsubishi Triton GLX+', '714 JBN'],
  ['zsev', 'Zara Ali', 'zara.ali@example.com', '2023 MG ZS EV Excite', '082 MEV'],
  ['focus', 'Peter Novak', 'peter.novak@example.com', '2014 Ford Focus Trend', '356 GKT'],
  // Registered at the counter this week, no visit yet: the one asset an owner may erase.
  ['hilux', 'Felix Grant', 'felix.grant@example.com', '2008 Toyota Hilux SR', '981 CYV'],
]
