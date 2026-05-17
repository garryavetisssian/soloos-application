import { Circle } from "lucide-react";

interface Props {
  items: string[];
}

export function MissingFieldsList({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((label) => (
        <li
          key={label}
          className="flex items-center gap-2 text-small text-secondary-foreground"
        >
          <Circle className="h-1.5 w-1.5 shrink-0 fill-warning text-warning" />
          {label}
        </li>
      ))}
    </ul>
  );
}
