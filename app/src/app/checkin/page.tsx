import { Suspense } from 'react';
import { CheckInScreen } from '@/components/checkin/CheckInScreen';

export default function CheckInPage() {
  return (
    <Suspense>
      <CheckInScreen />
    </Suspense>
  );
}
