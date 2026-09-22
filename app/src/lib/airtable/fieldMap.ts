/**
 * The integration contract: what every app field is actually reading out of the
 * Work Hotel base, and how confident we are about it.
 *
 * Authored against the live schema, not guessed. `ambiguous` and `unmapped` entries
 * are the open questions — they are what the UI flags and what /integration lists,
 * so that a demo reviewer can tell a real value from a placeholder at a glance.
 */
export type MappingStatus =
  /** A direct 1:1 Airtable field. */
  | 'mapped'
  /** Computed from Airtable data; no single stored field holds it. */
  | 'derived'
  /** Two or more plausible sources, or the semantics differ — needs a decision. */
  | 'ambiguous'
  /** No source exists anywhere in the base. */
  | 'unmapped';

export interface FieldMapping {
  status: MappingStatus;
  /** Airtable table name, omitted when nothing maps. */
  table?: string;
  /** Airtable field name, omitted when nothing maps. */
  field?: string;
  /** Why it is ambiguous/derived/unmapped. Shown verbatim on /integration. */
  note?: string;
}

export type EntityName =
  | 'Property' | 'Room' | 'Bed' | 'Resident' | 'Stay' | 'Booking'
  | 'Payment' | 'Transfer' | 'Registration' | 'User' | 'FloorPlan' | 'FloorZone';

/** Which Airtable table backs each entity. Null means nothing in the base does. */
export const ENTITY_TABLE: Record<EntityName, string | null> = {
  Property: 'Hostels',
  Room: 'Rooms',
  Bed: 'Places',
  Resident: 'Tenants',
  // Mirrored names: our Booking is their Requests, our Stay is their Booking.
  Booking: 'Requests',
  Stay: 'Booking',
  Transfer: 'Money transfer',
  Registration: 'Residences',
  User: 'App users',
  Payment: null,
  FloorPlan: null,
  FloorZone: null,
};

const ID: FieldMapping = { status: 'mapped', field: 'RECORD_ID()', note: "Airtable's own record id." };

export const FIELD_MAP: Record<EntityName, Record<string, FieldMapping>> = {
  Property: {
    id: { ...ID, table: 'Hostels' },
    name: { status: 'mapped', table: 'Hostels', field: 'hostel' },
    price: {
      status: 'ambiguous',
      table: 'Hostels',
      field: 'min_intPrice',
      note: 'Hostels has no single default price. min_intPrice is the cheapest room rollup, and on real data it does not equal the value the app used (Behovice: app 210, min 150, max 240). Using it as a stand-in until the real source is named.',
    },
    registrations: { status: 'mapped', table: 'Hostels', field: 'numberOfRegistrations' },
    registrationsCapacity: { status: 'mapped', table: 'Hostels', field: 'MAXnumberOfRegistrations' },
    balance: { status: 'mapped', table: 'Hostels', field: 'balance', note: 'Formula: paid − sum_money_received.' },
    inProcess: {
      status: 'unmapped',
      note: 'No "in process" field exists anywhere in the base. Could plausibly be derived from Requests with status "Новий", but that is a guess — needs confirming before it shows a number.',
    },
    bookedMale: { status: 'mapped', table: 'Hostels', field: 'booked man' },
    bookedFemale: { status: 'mapped', table: 'Hostels', field: 'booked woman' },
    bookedMixed: { status: 'mapped', table: 'Hostels', field: 'booked family', note: 'Our "mixed" is their "family".' },
  },

  Room: {
    id: { ...ID, table: 'Rooms' },
    propertyId: { status: 'mapped', table: 'Rooms', field: 'hostel rel' },
    name: { status: 'mapped', table: 'Rooms', field: 'room', note: 'Formula built from room number + letter.' },
    type: { status: 'mapped', table: 'Rooms', field: 'type', note: 'Кімната→Room, Квартира→Apartment, Вагончик→Wagon.' },
    priceFrom: {
      status: 'ambiguous',
      table: 'Rooms',
      field: 'internal price',
      note: 'Not a low–high range. Airtable holds two rate tiers: internal (own staff) and external (commercial). Mapped onto priceFrom/priceTo so the numbers are real, but the meaning differs.',
    },
    priceTo: {
      status: 'ambiguous',
      table: 'Rooms',
      field: 'external price',
      note: 'The external/commercial tier, not an upper bound. Both are rollups from Places, so a room with no places returns nothing.',
    },
  },

  Bed: {
    id: { ...ID, table: 'Places' },
    roomId: { status: 'mapped', table: 'Places', field: 'Room' },
    propertyId: {
      status: 'derived',
      table: 'Places',
      field: 'hostel_recID',
      note: 'Places has no direct link to Hostels — the hostel is reached through Room. Read from the hostel_recID lookup.',
    },
    index: { status: 'mapped', table: 'Places', field: 'Place number', note: 'Stored as text ("4"); cast to number on read.' },
    status: {
      status: 'derived',
      table: 'Places',
      field: 'status',
      note: 'Airtable stores only Доступне/Недоступне. Our occupied and booked states are not stored at all — they are derived from the Booking records pointing at the place.',
    },
    residentId: {
      status: 'derived',
      table: 'Booking',
      field: 'tenant',
      note: 'Places does have a Tenants link, but it is unpopulated in practice — exactly one row in the whole 852-row table uses it. The occupant is therefore taken from the active Booking pointing at the place.',
    },
  },

  Resident: {
    id: { ...ID, table: 'Tenants' },
    name: { status: 'mapped', table: 'Tenants', field: 'name' },
    gender: { status: 'mapped', table: 'Tenants', field: 'gender', note: 'Чоловік→M, Жінка→F. A blank choice also exists and yields no gender.' },
    phone: { status: 'mapped', table: 'Tenants', field: 'phone' },
    dob: { status: 'mapped', table: 'Tenants', field: 'birthday' },
    avatarUrl: { status: 'unmapped', note: 'Tenants carries no photo field.' },
    passportDocs: { status: 'mapped', table: 'Tenants', field: 'passport_file' },
    otherDocs: { status: 'unmapped', note: 'No general document attachment field on Tenants — only the passport one.' },
  },

  Stay: {
    id: { ...ID, table: 'Booking' },
    residentId: { status: 'mapped', table: 'Booking', field: 'tenant' },
    residentName: { status: 'mapped', table: 'Booking', field: 'tenant name' },
    propertyId: { status: 'mapped', table: 'Booking', field: 'hostel rel' },
    roomId: {
      status: 'derived',
      table: 'Places',
      field: 'Room',
      note: "Booking's own `room rels` is a lookup rather than a link, so it cannot be filtered or relied on. The room is resolved through the booked place instead — same answer, reliable route.",
    },
    bedId: {
      status: 'ambiguous',
      table: 'Booking',
      field: 'Places',
      note: 'Airtable allows up to 5 places on one booking (place 2..5 entered id); our model has exactly one bed per stay, so only the first is kept.',
    },
    type: {
      status: 'derived',
      table: 'Tenants',
      field: 'type',
      note: 'Internal/Commercial lives on the tenant, not on the stay — so in Airtable it cannot vary between two stays by the same person, but in our model it can.',
    },
    manager: { status: 'mapped', table: 'Booking', field: 'manger', note: 'Field name is misspelled in Airtable; kept misspelled in code deliberately.' },
    project: { status: 'mapped', table: 'Booking', field: 'projectName' },
    checkIn: { status: 'mapped', table: 'Booking', field: 'start date' },
    checkOut: { status: 'mapped', table: 'Booking', field: 'end date' },
    status: {
      status: 'derived',
      table: 'Booking',
      field: 'activity status',
      note: 'Airtable has two different formula fields both called a status: "activity status" (Активнi/Виселенi, about the person) and "status" (Зайнято/Вільно, about the place). Our single active/checked-out maps to the first.',
    },
    rate: { status: 'mapped', table: 'Booking', field: 'price per day' },
    paidTotal: {
      status: 'mapped',
      table: 'Booking',
      field: 'paid',
      note: 'Airtable keeps no per-transaction ledger, only this running total on the stay.',
    },
    debt: { status: 'mapped', table: 'Booking', field: 'debt', note: 'A formula field, not a stored number.' },
  },

  Booking: {
    id: { ...ID, table: 'Requests' },
    residentName: { status: 'mapped', table: 'Requests', field: 'tenant name', note: 'Matched to the text field, not the tenant link — confirmed by the team.' },
    type: {
      status: 'derived',
      table: 'Tenants',
      field: 'type',
      note: 'Same as Stay.type: the flag lives on the tenant, not the request. In the recorded snapshot only the tenants behind current stays were captured, so a request naming anyone else falls back to Internal — treat the split as indicative there, not as read from the base.',
    },
    propertyId: { status: 'mapped', table: 'Requests', field: 'hostel' },
    date: { status: 'mapped', table: 'Requests', field: 'start date' },
    comment: {
      status: 'ambiguous',
      table: 'Requests',
      field: 'note',
      note: 'Requests has both "note" and "comment" and the difference is undocumented. Reading "note" and falling back to "comment".',
    },
    by: { status: 'mapped', table: 'Requests', field: 'creator' },
    status: { status: 'mapped', table: 'Requests', field: 'status', note: 'Новий→New, Заселен→Checked-in, Скасовано→Cancelled.' },
    manager: { status: 'mapped', table: 'Requests', field: 'manager' },
    project: {
      status: 'unmapped',
      note: 'Requests has no project field of its own. It would have to come through the tenant, which this table does not expose.',
    },
    payer: {
      status: 'ambiguous',
      table: 'Requests',
      field: 'payer',
      note: 'A link to Tenants, while our model holds a plain name. We show the linked record id until the display name is resolved.',
    },
    family: { status: 'mapped', table: 'Requests', field: 'family' },
    discount: {
      status: 'ambiguous',
      table: 'Requests',
      field: 'discount',
      note: 'Airtable stores a discount twice — as an amount and as discount_percentage. Which one is authoritative is undecided.',
    },
  },

  Payment: {
    id: { status: 'unmapped', note: 'The base has no payment table at all.' },
    stayId: { status: 'unmapped' },
    propertyId: { status: 'unmapped' },
    amount: {
      status: 'unmapped',
      note: 'Payments exist in Airtable only as running totals on a Booking (paid / debt / overpaid). Individual transactions were never recorded, so the payment history cannot be reconstructed.',
    },
    by: { status: 'unmapped' },
    at: { status: 'unmapped' },
    docName: { status: 'unmapped' },
    docUrl: { status: 'unmapped' },
    note: { status: 'unmapped' },
  },

  Transfer: {
    id: { ...ID, table: 'Money transfer' },
    propertyId: { status: 'mapped', table: 'Money transfer', field: 'Hostels' },
    by: { status: 'mapped', table: 'Money transfer', field: 'sender' },
    to: {
      status: 'ambiguous',
      table: 'Money transfer',
      field: 'courier',
      note: 'Two recipient fields exist — "courier" and "reciever" (sic) — and our model has one. Reading courier, falling back to reciever. Which one is the real recipient is an open question.',
    },
    amount: { status: 'mapped', table: 'Money transfer', field: 'sum' },
    date: {
      status: 'derived',
      table: 'Money transfer',
      field: 'created',
      note: 'Airtable has only the system creation timestamp; our field is a hand-authored dd/mm/yyyy hh:mm string, reformatted on read.',
    },
    status: { status: 'mapped', table: 'Money transfer', field: 'status', note: 'Передано→Handed over, Отримано→Accepted.' },
  },

  Registration: {
    id: { ...ID, table: 'Residences' },
    residentName: { status: 'mapped', table: 'Residences', field: 'name' },
    type: { status: 'mapped', table: 'Residences', field: 'type', note: 'Безкоштовна→Free, Платна→Paid.' },
    status: {
      status: 'ambiguous',
      table: 'Residences',
      field: 'status',
      note: 'Only Нова→New is confirmed. Оформлена→Registered, Завершена→Expired and Відхилена→Cancelled are assumed. The table also has two near-identical "Відхилена" choices differing only by a Cyrillic і versus a Latin i, so both are matched.',
    },
    propertyId: { status: 'mapped', table: 'Residences', field: 'Hostel' },
    coordinator: {
      status: 'ambiguous',
      table: 'Residences',
      field: 'creator',
      note: 'Two candidates: "creator" and "visa_manager_name". On the records checked they held the same person, so they may be one role under two names — unconfirmed.',
    },
    issued: { status: 'mapped', table: 'Residences', field: 'start_date' },
    expires: { status: 'mapped', table: 'Residences', field: 'expiration_date' },
    docs: {
      status: 'ambiguous',
      table: 'Residences',
      field: 'fileNames',
      note: 'Our field is a document count; Airtable has plain text "files"/"fileNames", not attachments. Counting comma-separated names is a guess at the format.',
    },
  },

  User: {
    id: { ...ID, table: 'App users' },
    name: {
      status: 'mapped',
      table: 'App users',
      field: 'Full name',
      note: 'Some rows hold a hostel name rather than a person ("P.Svandy"), i.e. shared logins per property rather than personal accounts.',
    },
    email: { status: 'mapped', table: 'App users', field: 'Email' },
    role: {
      status: 'ambiguous',
      table: 'App users',
      field: 'Role',
      note: 'Airtable has Commandant/Admin/Manager/Super commandant against our Administrator/Company employee/Commandant/Client — only Commandant overlaps. And the table has had no new row since Nov 2023, so it may not be the real source of access at all.',
    },
  },

  FloorPlan: {
    id: { status: 'unmapped' },
    propertyId: { status: 'unmapped' },
    name: { status: 'unmapped' },
    sort: { status: 'unmapped' },
    imageUrl: { status: 'unmapped', note: 'Floor plans do not exist in Airtable in any form — this stays an app-only feature.' },
  },

  FloorZone: {
    id: { status: 'unmapped' },
    planId: { status: 'unmapped' },
    roomId: { status: 'unmapped' },
    x: { status: 'unmapped' },
    y: { status: 'unmapped' },
    w: { status: 'unmapped' },
    h: { status: 'unmapped' },
  },
};

/** `unmapped` and `ambiguous` are what the UI flags; mapped and derived are trustworthy. */
export function isFlagged(entity: EntityName, field: string): boolean {
  const status = FIELD_MAP[entity]?.[field]?.status;
  return status === 'unmapped' || status === 'ambiguous';
}

export function mappingFor(entity: EntityName, field: string): FieldMapping | undefined {
  return FIELD_MAP[entity]?.[field];
}

export function countByStatus(): Record<MappingStatus, number> {
  const totals: Record<MappingStatus, number> = { mapped: 0, derived: 0, ambiguous: 0, unmapped: 0 };
  for (const fields of Object.values(FIELD_MAP)) {
    for (const mapping of Object.values(fields)) totals[mapping.status]++;
  }
  return totals;
}
