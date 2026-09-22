#!/usr/bin/env node
/**
 * Replaces every personal detail in src/data/capture/ with stable invented stand-ins.
 *
 * The capture is committed to a PUBLIC repository, so no real person may appear in
 * it. Structure is what makes the demo worth looking at — occupancy, rooms, prices,
 * balances, dates, statuses — and all of that is left untouched; only who the people
 * are is replaced. Run it again after any re-capture.
 *
 *   node scripts/pseudonymize-capture.js
 *
 * Names map one-to-one and deterministically, so the same person keeps the same
 * stand-in across every file and the joins between them still hold.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'data', 'capture');

const GIVEN = [
  'Andrii', 'Olena', 'Serhii', 'Iryna', 'Mykola', 'Nataliia', 'Petro', 'Oksana', 'Vasyl', 'Tetiana',
  'Dmytro', 'Kateryna', 'Ihor', 'Svitlana', 'Roman', 'Halyna', 'Taras', 'Liudmyla', 'Bohdan', 'Marta',
  'Yurii', 'Nadiia', 'Volodymyr', 'Viktoriia', 'Pavlo', 'Sofiia', 'Maksym', 'Yuliia', 'Denys', 'Anna',
  'Oleh', 'Larysa', 'Ruslan', 'Zoriana', 'Vitalii', 'Daryna', 'Stepan', 'Alina', 'Yaroslav', 'Vira',
];
const FAMILY = [
  'Kovalenko', 'Bondarenko', 'Tkachenko', 'Shevchuk', 'Melnyk', 'Boiko', 'Kravets', 'Polishchuk',
  'Savchenko', 'Rudenko', 'Marchenko', 'Lysenko', 'Moroz', 'Klymenko', 'Hrytsenko', 'Danyliuk',
  'Palamarchuk', 'Voloshyn', 'Zhuravel', 'Sydorenko', 'Havryliuk', 'Osypenko', 'Nazarenko', 'Tymoshenko',
  'Yatsenko', 'Chernenko', 'Didyk', 'Panchenko', 'Romaniuk', 'Kulyk', 'Stelmakh', 'Verbytskyi',
  'Zahorodnii', 'Prokopenko', 'Lytvyn', 'Onyshchenko', 'Reznik', 'Shulha', 'Tkachuk', 'Yurchenko',
];

const assigned = new Map();
function pseudonym(real) {
  const key = String(real).trim();
  if (!key) return real;
  if (!assigned.has(key)) {
    const n = assigned.size;
    const family = FAMILY[n % FAMILY.length];
    const given = GIVEN[Math.floor(n / FAMILY.length) % GIVEN.length];
    // Suffix once the pools wrap, so two real people never collapse into one name.
    const wrap = Math.floor(n / (FAMILY.length * GIVEN.length));
    assigned.set(key, `${family} ${given}${wrap ? ` ${wrap + 1}` : ''}`);
  }
  return assigned.get(key);
}

/** Per file: which fields hold a person's name, and which must be dropped outright. */
const RULES = {
  'residents.json': { names: ['name', 'name_inp'], drop: ['phone', 'birthday', 'passport'] },
  'stays.json': { names: ['tenant name', 'manger'], drop: [] },
  // note/comment are free text and carry personal circumstances — employers, family
  // situations, who said what about whom — that cannot be safely redacted field-wise.
  'bookings.json': { names: ['tenant name', 'manager', 'creator'], drop: ['note', 'comment'] },
  // `files` holds protocol-relative CDN links to each person's registration PDF —
  // openable by anyone with the URL. `fileNames` is kept: it is only timestamps, and
  // the app counts it for Registration.docs.
  'registrations.json': { names: ['name', 'creator', 'visa_manager_name'], drop: ['files'] },
  'transfers.json': { names: ['sender', 'courier', 'reciever'], drop: [] },
  'users.json': { names: ['Full name'], drop: [], emails: ['Email'] },
};

let changed = 0;
let dropped = 0;

for (const [file, rule] of Object.entries(RULES)) {
  const full = path.join(DIR, file);
  const records = JSON.parse(fs.readFileSync(full, 'utf8'));

  for (const record of records) {
    for (const field of rule.names) {
      if (record.fields[field]) {
        record.fields[field] = pseudonym(record.fields[field]);
        changed++;
      }
    }
    for (const field of rule.drop) {
      if (field in record.fields) {
        delete record.fields[field];
        dropped++;
      }
    }
    for (const field of rule.emails ?? []) {
      if (record.fields[field]) {
        const person = record.fields['Full name'] ?? 'user';
        record.fields[field] = `${String(person).toLowerCase().replace(/[^a-z]+/g, '.')}@example.invalid`;
        changed++;
      }
    }
  }

  fs.writeFileSync(full, JSON.stringify(records, null, 1) + '\n');
  console.log(`${file.padEnd(22)} ${records.length} records`);
}

console.log(`\n${assigned.size} distinct people replaced · ${changed} name fields rewritten · ${dropped} sensitive fields removed`);
