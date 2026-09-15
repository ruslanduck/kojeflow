'use client';

import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { PropertiesDashboard } from '@/components/dashboard/PropertiesDashboard';
import { PropertyDetail } from '@/components/dashboard/PropertyDetail';

/** A role locked to one property (Commandant) sees that property's page here instead of the list. */
export default function DashboardPage() {
  const role = useSessionStore((s) => s.role);
  const properties = useEntityStore((s) => s.properties);
  const ownHostel = ROLES[role].ownHostel;

  if (ownHostel) {
    const property = properties.find((p) => p.name === ownHostel);
    if (property) return <PropertyDetail propertyId={property.id} showBackToDash={false} />;
  }

  return <PropertiesDashboard />;
}
