import { CategoryIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";

const SIZES = { sm: "size-8 rounded-[10px] [&_svg]:size-4", md: "size-11 rounded-[14px] [&_svg]:size-5", lg: "size-14 rounded-[18px] [&_svg]:size-6" };

/** Ícone de categoria: "quadrado arredondado" com fundo translúcido na cor da categoria (padrão dos apps modernos). */
export function CategoryBadge({ icon, color = "#94a3b8", size = "md", className }: {
  icon?: string | null; color?: string | null; size?: keyof typeof SIZES; className?: string;
}) {
  const c = color ?? "#94a3b8";
  return (
    <span
      className={cn("grid shrink-0 place-items-center", SIZES[size], className)}
      style={{ background: `color-mix(in oklab, ${c} 17%, transparent)`, color: c }}
    >
      <CategoryIcon name={icon} />
    </span>
  );
}
