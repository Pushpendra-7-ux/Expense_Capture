import {
  Briefcase,
  Car,
  MoreHorizontal,
  Plane,
  Receipt,
  Smartphone,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import { cn } from '../../lib/cn';

const icons = {
  cab_local_transport: Car,
  travel: Plane,
  client_meals_entertainment: Wine,
  team_meals: UtensilsCrossed,
  communication_data: Smartphone,
  office_supplies: Briefcase,
  other: MoreHorizontal,
};

export function CategoryIcon({
  category,
  className,
  size = 18,
}: {
  category?: string | null;
  className?: string;
  size?: number;
}) {
  const Icon = category
    ? icons[category as keyof typeof icons] || Receipt
    : Receipt;
  return <Icon size={size} className={cn('shrink-0', className)} />;
}
