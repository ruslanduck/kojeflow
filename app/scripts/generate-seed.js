// One-off, deterministic seed generator for Stage 1 fake data.
//
// This ports the exact algorithms from Leglo.dc.html's Component class
// (seededRooms, seedTenants, seedBookings, seedPayments, rateFor, hash,
// isFemale/gender, roomGender) so the generated fixtures reproduce the same
// properties/rooms/beds/residents/bookings/payments as the design prototype,
// but as a normalized entity model with real ids and foreign keys instead of
// name-string joins. Run once; output is committed under src/data/seed/.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'prototype-source');
const hostelsRaw = require(path.join(SRC, 'hostels-raw.json'));
const transfersRaw = require(path.join(SRC, 'transfers-raw.json'));
const registrationsRaw = require(path.join(SRC, 'registrations-raw.json'));
const tenantsRaw = require(path.join(SRC, 'tenants-raw.json'));
const { MALE, FEMALE, SURN, MANAGERS, PROJECTS, MANAGER_PROJECTS } = require(path.join(SRC, 'name-pools.json'));

const TODAY = '2026-07-25'; // fixed reference date the whole prototype is anchored to

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

function isFemale(n) {
  return FEMALE.some((f) => String(n).includes(f)) || /a\b|ova|yna|liia/.test(String(n).toLowerCase());
}
function genderOf(n) {
  return isFemale(n) ? 'F' : 'M';
}

function addDays(iso, n) {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
function diffDays(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
function toISO(ddmmyyyy) {
  const p = String(ddmmyyyy).split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ddmmyyyy;
}

const priceByProperty = {};
hostelsRaw.forEach((h) => (priceByProperty[h.name] = h.price));
const rateCache = {};
function rateFor(propertyName, place) {
  const k = propertyName + '|' + place;
  if (rateCache[k] !== undefined) return rateCache[k];
  const base = priceByProperty[propertyName] !== undefined ? priceByProperty[propertyName] : 220;
  return (rateCache[k] = base + (hash(k) % 6) * 5);
}

// ---- seededRooms: port of Component.seededRooms(name) ----
function seededRooms(raw) {
  let s = 0;
  for (const ch of raw.name) s += ch.charCodeAt(0);
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const nRooms = Math.min(9, Math.max(3, raw.rooms > 12 ? 9 : raw.rooms));
  const types = ['Room', 'Room', 'Apartment', 'Room', 'Wagon', 'Apartment', 'Room', 'Room', 'Wagon'];
  const pickName = () => {
    const surname = SURN[Math.floor(rnd() * SURN.length)];
    const isF = rnd() < 0.4;
    const first = isF ? FEMALE[Math.floor(rnd() * FEMALE.length)] : MALE[Math.floor(rnd() * MALE.length)];
    return surname + ' ' + first;
  };
  const rooms = [];
  const typeGroups = { Room: [], Apartment: [], Wagon: [] };
  for (let i = 0; i < nRooms; i++) {
    const type = types[i % types.length];
    const idx = typeGroups[type].length + 1;
    const total = type === 'Apartment' ? 2 + Math.floor(rnd() * 3) : type === 'Wagon' ? 4 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 4);
    const fillBias = raw.free <= 0 ? 0.95 : 0.62;
    const places = [];
    let occ = 0;
    for (let p = 0; p < total; p++) {
      const r = rnd();
      if (r < fillBias) {
        const nm = pickName();
        places.push({ state: 'occupied', tenant: nm });
        occ++;
      } else if (r < fillBias + 0.12) {
        places.push({ state: 'booked', tenant: '' });
      } else {
        places.push({ state: 'free', tenant: '' });
      }
    }
    const pf = raw.price + Math.floor(rnd() * 40);
    const pt = pf + 20 + Math.floor(rnd() * 60);
    const room = { name: type + ' ' + idx, type, total, occupied: occ, places, priceFrom: pf, priceTo: pt };
    rooms.push(room);
    typeGroups[type].push(room);
  }
  return rooms;
}

// ---- seedTenants: port of Component.seedTenants() ----
// Cross-references the known named tenantsRaw rows onto occupied beds (in property
// order) so those specific residents/managers/projects appear exactly as authored,
// then fills any remaining occupied beds with generated manager/project/check-in data.
function assignTenantDetails(hostelsWithRooms) {
  const known = tenantsRaw.map((x) => ({ ...x }));
  const seen = new Set();
  const uniq = (n) => {
    if (!seen.has(n)) return n;
    const suffixes = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    let i = 0,
      c = n + ' ' + suffixes[i];
    while (seen.has(c)) {
      i++;
      c = n + ' ' + (suffixes[i] || String(i + 2));
    }
    return c;
  };

  const details = []; // {propertyName, roomName, bedIndex, name, type, manager, project, checkIn}
  hostelsWithRooms.forEach(({ raw, rooms }) => {
    rooms.forEach((r) => {
      r.places.forEach((p, i) => {
        if (p.state !== 'occupied') return;
        const slot = known.findIndex((t) => t.hostel === raw.name);
        if (slot >= 0) {
          const t = known.splice(slot, 1)[0];
          const nm = uniq(t.name);
          seen.add(nm);
          p.tenant = nm;
          details.push({ propertyName: raw.name, roomName: r.name, bedIndex: i, name: nm, type: t.type, manager: t.manager, project: t.project, checkIn: toISO(t.checkIn) });
          return;
        }
        const nm = uniq(p.tenant);
        seen.add(nm);
        p.tenant = nm;
        const k = hash(nm + raw.name);
        const internal = k % 4 !== 0;
        const mgr = MANAGERS[k % MANAGERS.length];
        const pr = MANAGER_PROJECTS[mgr] || PROJECTS;
        details.push({
          propertyName: raw.name, roomName: r.name, bedIndex: i, name: nm,
          type: internal ? 'Internal' : 'Commercial', manager: mgr,
          project: internal ? pr[k % pr.length] : 'Client direct',
          checkIn: addDays(TODAY, -(5 + (k % 210))),
        });
      });
    });
  });
  return details;
}

function seedPayments(stays) {
  const staff = ['Anna Kovalenko', 'Valeriia Kondratenko', 'Natalia Vakarov'];
  const out = [];
  stays.forEach((t, i) => {
    const days = Math.max(1, diffDays(t.checkIn, TODAY));
    const k = hash(t.residentName + i);
    const share = [1, 1, 0.64, 0.35, 0][k % 5];
    if (share <= 0) return;
    const total = Math.round(days * t.rate * share);
    const n = share >= 1 ? 1 + (k % 2) : 1;
    for (let j = 0; j < n; j++) {
      out.push({
        id: `pm${i}_${j}`, stayId: t.id, propertyId: t.propertyId,
        amount: Math.round(total / n), by: staff[(k + j) % staff.length],
        at: addDays(t.checkIn, Math.min(days - 1, 3 + ((k + j * 11) % 22))),
        docName: `bank-statement-${1000 + ((k + j) % 8999)}.pdf`,
        note: j ? 'top-up' : '',
      });
    }
  });
  return out;
}

// ---- build everything ----
const properties = hostelsRaw.map((h) => ({
  id: slugify(h.name),
  name: h.name,
  price: h.price,
  registrations: h.reg,
  registrationsCapacity: h.regMax,
  balance: h.bal,
  inProcess: h.proc,
  bookedMale: h.bM,
  bookedFemale: h.bF,
  bookedMixed: h.bX,
}));

const hostelsWithRooms = hostelsRaw.map((raw) => ({ raw, rooms: seededRooms(raw) }));
const tenantDetails = assignTenantDetails(hostelsWithRooms);
const detailByKey = new Map(tenantDetails.map((d) => [`${d.propertyName}|${d.roomName}|${d.bedIndex}`, d]));

const rooms = [];
const beds = [];
const residents = [];
const stays = [];
let stayCounter = 1;

hostelsWithRooms.forEach(({ raw, rooms: rawRooms }) => {
  const propertyId = slugify(raw.name);
  rawRooms.forEach((r, ri) => {
    const roomId = `${propertyId}-r${ri + 1}`;
    rooms.push({ id: roomId, propertyId, name: r.name, type: r.type, priceFrom: r.priceFrom, priceTo: r.priceTo });
    r.places.forEach((p, bi) => {
      const bedId = `${roomId}-b${bi + 1}`;
      const bed = { id: bedId, roomId, propertyId, index: bi + 1, status: p.state, residentId: null };
      if (p.state === 'occupied') {
        const d = detailByKey.get(`${raw.name}|${r.name}|${bi}`);
        const residentId = `res-${slugify(d.name)}-${hash(bedId) % 9973}`;
        residents.push({ id: residentId, name: d.name, gender: genderOf(d.name) });
        const stayId = `st${stayCounter++}`;
        const rate = rateFor(raw.name, `${r.name} · Place ${bi + 1}`);
        stays.push({
          id: stayId, residentId, residentName: d.name, propertyId, roomId, bedId,
          type: d.type, manager: d.manager, project: d.project, checkIn: d.checkIn,
          checkOut: null, status: 'active', rate,
        });
        bed.residentId = residentId;
      }
      beds.push(bed);
    });
  });
});

const payments = seedPayments(stays);

const bookings = [
  ['Kondratenko Valeriia', 'Internal', 'Korycany', '22/07/2026', '4 places 22.07-5.8', 'Valeriia Kondratenko', 'New', 'Valeriia Kondratenko', 'Panattoni Logistics'],
  ['Ozolins Lauris', 'Commercial', 'Mnichovo Hradiste', '25/07/2026', '25-26 july', 'Lilia Mamiseishvili', 'New', 'Iurii Turok', '—'],
  ['Ando Richard', 'Internal', 'P.Svandy', '23/07/2026', '23-24 July booking', 'Lilia Mamiseishvili', 'New', 'Natalia Vakarov', 'ACI — Auto Components Int.'],
  ['Ando Aileen', 'Internal', 'P.Svandy', '23/07/2026', '23-24 July booking', 'Lilia Mamiseishvili', 'New', 'Natalia Vakarov', 'ACI — Auto Components Int.'],
  ['Mondych Vasyl', 'Internal', 'P.Svandy', '23/07/2026', '23-24 july', 'Lilia Mamiseishvili', 'New', 'Natalia Vakarov', 'Metrostav Hasičarna'],
  ['Basko Ihor', 'Commercial', 'P.Svandy', '23/07/2026', '23-24 july', 'Lilia Mamiseishvili', 'New', 'Iurii Turok', '—'],
  ['Viieru Olha', 'Internal', 'Chuchle', '20/07/2026', 'long stay', 'Natalia Vakarov', 'Checked-in', 'Natalia Vakarov', 'Škoda Line 4'],
  ['Liashenko Oleksii', 'Internal', 'Behovice', '18/07/2026', '', 'Natalia Vakarov', 'Checked-in', 'Natalia Vakarov', 'ACI — Auto Components Int.'],
  ['Krasulia Oleksandr', 'Commercial', 'Kralupy', '15/07/2026', 'cancelled by client', 'Iurii Turok', 'Cancelled', 'Iurii Turok', '—'],
  ['Dmytriiev Dmytro', 'Internal', 'Chocerady', '10/07/2026', '', 'Lilia Mamiseishvili', 'Checked-in', 'Lilia Mamiseishvili', 'ACI — Auto Components Int.'],
].map(([residentName, type, hostel, date, comment, by, status, manager, project], i) => ({
  id: `bk${i + 1}`, residentName, type, propertyId: slugify(hostel), date: toISO(date), comment, by, status,
  manager, project, payer: type === 'Commercial' ? 'Client direct' : manager, family: false, discount: null,
}));

const transfers = transfersRaw.map((t, i) => ({
  id: `tr${i + 1}`, propertyId: slugify(t.hostel), by: t.by, to: t.to, amount: t.amount,
  date: t.date, status: t.status === 'Handed over' ? 'Handed over' : 'Accepted',
}));

// Ports Component.regDates(name,i): deterministic issued/expires/docs from a name+index hash.
function regDates(name, i) {
  const h = hash(name + i);
  const issued = addDays(TODAY, -(20 + (h % 160)));
  const expires = addDays(issued, 90 + (h % 4) * 30);
  const docs = 1 + (h % 3);
  return { issued, expires, docs };
}

const registrations = registrationsRaw.map((r, i) => ({
  id: `rg${i + 1}`, residentName: r.name, type: r.type, status: r.status,
  propertyId: slugify(r.hostel), coordinator: r.visa, ...regDates(r.name, i),
}));

const users = [
  { id: 'u1', name: 'Anna Kovalenko', email: 'anna@kojeflow.app', role: 'Administrator' },
  { id: 'u2', name: 'Natalia Vakarov', email: 'natalia@kojeflow.app', role: 'Company employee' },
  { id: 'u3', name: 'Iurii Turok', email: 'iurii@kojeflow.app', role: 'Company employee' },
  { id: 'u4', name: 'Valeriia Kondratenko', email: 'valeriia@kojeflow.app', role: 'Commandant' },
];

const outDir = path.join(__dirname, '..', 'src', 'data', 'seed');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2) + '\n');
write('properties.json', properties);
write('rooms.json', rooms);
write('beds.json', beds);
write('residents.json', residents);
write('stays.json', stays);
write('bookings.json', bookings);
write('payments.json', payments);
write('transfers.json', transfers);
write('registrations.json', registrations);
write('users.json', users);

console.log('properties', properties.length, 'rooms', rooms.length, 'beds', beds.length,
  'residents', residents.length, 'stays', stays.length, 'bookings', bookings.length,
  'payments', payments.length, 'transfers', transfers.length, 'registrations', registrations.length,
  'users', users.length);
