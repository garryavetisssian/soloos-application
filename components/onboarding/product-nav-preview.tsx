import {
  FileText,
  Kanban,
  LayoutDashboard,
  Mail,
  Settings,
  User,
} from "lucide-react";

// Muted, non-interactive preview of the eventual product navigation.
// Rendered in the left sidebar slot whenever the user hasn't committed to
// the manual onboarding path yet (decide screen, CV import flow). Once the
// user clicks "Start manual setup", this is replaced by StepNavigation.
const ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "CVs", icon: FileText },
  { label: "Cover letters", icon: Mail },
  { label: "Job tracker", icon: Kanban },
  { label: "Profile", icon: User },
  { label: "Settings", icon: Settings },
] as const;

export function ProductNavPreview() {
  return (
    <nav aria-label="Product navigation preview" className="space-y-1">
      <div className="px-3 pb-3 text-small uppercase tracking-wide text-muted-foreground">
        SoloOS
      </div>
      <ul className="space-y-0.5">
        {ITEMS.map(({ label, icon: Icon }) => (
          <li key={label}>
            <span className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-small text-muted-foreground">
              <Icon className="h-4 w-4 opacity-70" />
              {label}
            </span>
          </li>
        ))}
      </ul>
      <p className="px-3 pt-5 text-small text-muted-foreground">
        Unlocks once your profile reaches 80%.
      </p>
    </nav>
  );
}
