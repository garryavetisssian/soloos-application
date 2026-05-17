import {
  AlertCircle,
  CheckCircle2,
  FileQuestion,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CvStatus =
  | "none"
  | "selected"
  | "analyzing"
  | "analyzed"
  | "needs_manual"
  | "unreadable";

interface Props {
  status: CvStatus;
  filename?: string;
}

const COPY: Record<
  CvStatus,
  { label: string; sub: string; tone: "muted" | "info" | "success" | "warning" | "error" }
> = {
  none: {
    label: "No CV uploaded",
    sub: "Add a CV or continue manually.",
    tone: "muted",
  },
  selected: {
    label: "CV ready",
    sub: "Analyze to extract your career profile.",
    tone: "info",
  },
  analyzing: {
    label: "Analyzing your CV…",
    sub: "Extracting your career profile.",
    tone: "info",
  },
  analyzed: {
    label: "CV analyzed",
    sub: "Profile fields prefilled from your CV.",
    tone: "success",
  },
  needs_manual: {
    label: "Manual setup",
    sub: "You're filling the profile by hand.",
    tone: "muted",
  },
  unreadable: {
    label: "We couldn't read this CV",
    sub: "Try another file or continue manually.",
    tone: "warning",
  },
};

export function CvStatusIndicator({ status, filename }: Props) {
  const copy = COPY[status];
  return (
    <div className="flex items-start gap-3">
      <Icon status={status} />
      <div className="min-w-0">
        <div
          className={cn(
            "text-small font-medium",
            copy.tone === "error" && "text-destructive",
            copy.tone === "warning" && "text-warning",
            copy.tone === "success" && "text-success",
            (copy.tone === "info" || copy.tone === "muted") &&
              "text-foreground",
          )}
        >
          {copy.label}
        </div>
        <div className="text-small text-muted-foreground">{copy.sub}</div>
        {filename && (
          <div className="truncate pt-1 text-small text-muted-foreground">
            {filename}
          </div>
        )}
      </div>
    </div>
  );
}

function Icon({ status }: { status: CvStatus }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  switch (status) {
    case "analyzing":
      return <Loader2 className={cn(cls, "animate-spin text-foreground")} />;
    case "analyzed":
      return <CheckCircle2 className={cn(cls, "text-success")} />;
    case "selected":
      return <FileText className={cn(cls, "text-foreground")} />;
    case "unreadable":
      return <AlertCircle className={cn(cls, "text-warning")} />;
    case "needs_manual":
    case "none":
    default:
      return <FileQuestion className={cn(cls, "text-muted-foreground")} />;
  }
}
