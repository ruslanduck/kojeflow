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
  price: number;
  registrations: number;
  registrationsCapacity: number;
  balance: number;
  inProcess: number;
  bookedMale: number;
  bookedFemale: number;
  bookedMixed: number;
}

export interface Room {
  id: string;
  propertyId: string;
  name: string;
  type: RoomType;
  priceFrom: number;
  priceTo: number;
}

export interface Bed {
  id: string;
  roomId: string;
  propertyId: string;
  index: number;
  status: BedStatus;
  residentId: string | null;
}

export interface Resident {
  id: string;
  name: string;
  gender: Gender;
  phone?: string;
  dob?: string;
}

export interface Stay {
  id: string;
  residentId: string;
  residentName: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  type: StayType;
  manager: string;
  project: string;
  checkIn: string; // ISO date
  checkOut: string | null; // ISO date
  status: StayStatus;
  rate: number;
}

export interface Booking {
  id: string;
  residentName: string;
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
  residentName: string;
  type: RegistrationType;
  status: RegistrationStatus;
  propertyId: string;
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
  imageUrl: string;
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
