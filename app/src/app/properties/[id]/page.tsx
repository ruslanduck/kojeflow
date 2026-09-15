import { PropertyDetail } from '@/components/dashboard/PropertyDetail';

export default async function PropertyPage({ params }: PageProps<'/properties/[id]'>) {
  const { id } = await params;
  return <PropertyDetail propertyId={id} showBackToDash={true} />;
}
