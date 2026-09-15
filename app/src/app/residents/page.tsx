import { Suspense } from 'react';
import { ResidentsScreen } from '@/components/residents/ResidentsScreen';

export default function ResidentsPage() {
  return (
    <Suspense>
      <ResidentsScreen />
    </Suspense>
  );
}
