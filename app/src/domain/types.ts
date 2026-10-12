export type RoomType = 'Room' | 'Apartment' | 'Wagon';
export type BedStatus = 'free' | 'occupied' | 'booked' | 'unavailable';
export type Gender = 'M' | 'F';
export type RoomGender = 'M' | 'F' | 'X' | 'N';
export type StayType = 'Internal' | 'Commercial';
export type StayStatus = 'active' | 'checked-out';
export type BookingStatus = 'New' | 'Checked-in' | 'Cancelled';
export type RegistrationType = 'Free' | 'Paid';
export type RegistrationStatus = 'New' | 'Registered' | 'Expired' | 'Cancelled';
export type TransferStatus = 'Handed over' | 'Accepted';

export interface Property {
  id: string;
  name: string;
  /** Cheapest and dearest internal bed price across the property's available rooms. */
  price: number;
  priceTo: number;
  registrations: number;
  registrationsCapacity: number;
  balance: number;
  inProcess: number;
}

export interface Room {
  id: string;
  propertyId: string;
  name: string;
  type: RoomType;
  priceFrom: number;
  priceTo: number;
  /** An unavailable room offers no beds, whatever its beds say. */
  available: boolean;
}

export interface Bed {
  id: string;
  roomId: string;
  propertyId: string;
  index: number;
  status: BedStatus;
  residentId: string | null;
  /** Nightly price of this bed: its own price, else its room's. 0 when neither is set. */
  priceInternal: number;
  priceExternal: number;
}

export interface ResidentDocument {
  name: string;
  /** Signed URL of a stored file, or a local object URL for one not uploaded yet. */
  url: string;
  /** Stored documents: row id and object path in the tenant-documents bucket. */
  id?: string;
  path?: string;
  /** Picked but not uploaded yet. */
  file?: File;
}

export interface Resident {
  id: string;
  name: string;
  /** Unknown for many people imported from Airtable; never guessed. */
  gender: Gender | null;
  phone?: string;
  dob?: string;
  avatarUrl?: string;
  /** Object path of the avatar in the tenant-documents bucket. */
  avatarPath?: string;
  passportDocs?: ResidentDocument[];
  otherDocs?: ResidentDocument[];
}

export interface Stay {
  id: string;
  residentId: string;
  residentName: string;
  propertyId: string;
  roomId: string;
  /** First bed, for labels. */
  bedId: string;
  /** Every bed the stay holds (up to 5). */
  bedIds: string[];
  type: StayType;
  manager: string;
  project: string;
  checkIn: string; // ISO date
  checkOut: string | null; // ISO date
  status: StayStatus;
  /** Nightly price of the whole stay (all its beds). */
  rate: number;
  /**
   * Where the rate came from: the stay itself, the beds' prices (the stay had none or an
   * impossible one, like Airtable's 210200), or nowhere — then nothing is billed.
   */
  rateSource: 'stay' | 'beds' | 'none';
  /**
   * Running totals Airtable keeps on the stay itself. It has no per-transaction
   * ledger, so without these the app would sum an empty Payment list and report
   * every resident as owing their full charge. Absent on stays created in-session,
   * which do fall back to summing their local payments.
   */
  paidTotal?: number;
  debt?: number;
}

export interface Booking {
  id: string;
  residentId: string | null;
  residentName: string;
  gender: Gender | null;
  type: StayType;
  propertyId: string;
  date: string; // ISO date
  comment: string;
  by: string;
  status: BookingStatus;
  manager: string;
  project: string;
  payer: string;
  family: boolean;
  discount: string | null;
}

export interface Payment {
  id: string;
  stayId: string;
  propertyId: string;
  amount: number;
  by: string;
  at: string; // ISO date
  docName: string;
  docUrl: string;
  note: string;
}

export interface Transfer {
  id: string;
  propertyId: string;
  by: string;
  to: string;
  amount: number;
  date: string; // dd/mm/yyyy hh:mm, as authored
  status: TransferStatus;
}

export interface Registration {
  id: string;
  residentId: string | null;
  residentName: string;
  type: RegistrationType;
  status: RegistrationStatus;
  propertyId: string;
  /** Kept on the record so registrations at hidden properties still show their address. */
  propertyName: string;
  coordinator: string;
  issued: string; // ISO date
  expires: string; // ISO date
  docs: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface FloorPlan {
  id: string;
  propertyId: string;
  name: string;
  sort: number;
  /** Signed URL for display; expires, so it is re-issued with every data load. */
  imageUrl: string;
  /** Object path in the private floor-plans bucket. */
  imagePath?: string;
  /** Natural pixel size of the uploaded image, used to keep its aspect ratio. */
  imageWidth?: number;
  imageHeight?: number;
}

export interface FloorZone {
  id: string;
  planId: string;
  roomId: string;
  /** Percentages (0-100) of the plan image's width/height. */
  x: number;
  y: number;
  w: number;
  h: number;
}
