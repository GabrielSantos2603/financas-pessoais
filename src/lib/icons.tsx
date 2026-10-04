import {
  Baby, Briefcase, Building2, Car, CircleDollarSign, CirclePlus, CreditCard, Ellipsis, GraduationCap,
  HandCoins, HeartPulse, Home, Landmark, PiggyBank, Plane, PlugZap, Receipt, ShoppingBag, ShoppingCart,
  Sparkles, Tag, Utensils, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  baby: Baby, briefcase: Briefcase, "building-2": Building2, car: Car, "circle-dollar-sign": CircleDollarSign,
  "circle-plus": CirclePlus, "credit-card": CreditCard, ellipsis: Ellipsis, "graduation-cap": GraduationCap,
  "hand-coins": HandCoins, "heart-pulse": HeartPulse, home: Home, landmark: Landmark, "piggy-bank": PiggyBank,
  plane: Plane, "plug-zap": PlugZap, receipt: Receipt, "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart,
  sparkles: Sparkles, tag: Tag, utensils: Utensils,
};
export const ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Tag;
  return <Icon className={className} aria-hidden />;
}
