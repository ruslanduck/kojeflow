'use client';

import { useEntityStore } from '@/store/entities';
import { useScopedPropertyIds } from '@/store/scope';
import { PropertiesDashboard } from '@/components/dashboard/PropertiesDashboard';
import { PropertyDetail } from '@/components/dashboard/PropertyDetail';

/** A role locked to one property (Commandant) sees that property's page here instead of the list. */
export default function DashboardPage() {
  const properties = useEntityStore((s) => s.properties);
  const scope = useScopedPropertyIds();

  // A house manager of a single property lands straight on it.
  if (scope && scope.size === 1) {
    const property = properties.find((p) => scope.has(p.id));
    if (property) return <PropertyDetail propertyId={property.id} showBackToDash={false} />;
  }

  return <PropertiesDashboard />;
}
