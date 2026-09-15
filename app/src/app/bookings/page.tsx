import { Suspense } from 'react';
import { BookingsScreen } from '@/components/bookings/BookingsScreen';

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsScreen />
    </Suspense>
  );
}
