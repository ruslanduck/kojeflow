import { Suspense } from 'react';
import { FinanceScreen } from '@/components/finance/FinanceScreen';

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceScreen />
    </Suspense>
  );
}
