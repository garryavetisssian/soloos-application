import { cn } from "@/lib/utils";

interface Props {
  value: string;
  max: number;
}

export function CharCounter({ value, max }: Props) {
  const len = value.length;
  const over = len > max;
  return (
    <span
      className={cn(
        "tabular-nums",
        over ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {len} / {max} characters
    </span>
  );
}
