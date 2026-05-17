import type { OnboardingStep } from "@/lib/profile-form";

export interface StepDefinition {
  id: OnboardingStep;
  navTitle: string;
  navDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  // Copy shown in the right "Profile assistant" panel under
  // "What this step is for".
  guidance: string;
}

// Manual onboarding steps. CV import is intentionally NOT a step — it's a
// separate, optional fast-path screen reached from the decision screen or
// the helper card on each manual step.
export const STEPS: readonly StepDefinition[] = [
  {
    id: 1,
    navTitle: "Basic info",
    navDescription: "Name, role, contact",
    eyebrow: "Step 1 / Basic info",
    title: "Tell SoloOS who you are professionally.",
    subtitle:
      "These details are used across your CV, cover letters, and job applications.",
    guidance:
      "Make sure your name, role and contact details are accurate. These fields are used in every generated application.",
  },
  {
    id: 2,
    navTitle: "Experience",
    navDescription: "Years and summary",
    eyebrow: "Step 2 / Experience",
    title: "Show your career story.",
    subtitle:
      "How long you've been working and a short professional summary in your own words.",
    guidance:
      "Your years of experience and summary heavily influence AI-generated cover letters.",
  },
  {
    id: 3,
    navTitle: "Skills",
    navDescription: "Skills and tools",
    eyebrow: "Step 3 / Skills",
    title: "What you can do.",
    subtitle:
      "Skills are required, tools are optional. Both shape how SoloOS positions you.",
    guidance:
      "Skills and tools influence which roles SoloOS can tailor applications for.",
  },
  {
    id: 4,
    navTitle: "Languages",
    navDescription: "Spoken languages",
    eyebrow: "Step 4 / Languages",
    title: "Languages you speak.",
    subtitle:
      "Add every language you can communicate professionally in, with a proficiency level.",
    guidance:
      "Language proficiency helps SoloOS adapt applications for international roles.",
  },
  {
    id: 5,
    navTitle: "Goals",
    navDescription: "Target role and industries",
    eyebrow: "Step 5 / Goals",
    title: "Where are you headed?",
    subtitle:
      "The role and industries you want next — plus salary and work format if relevant.",
    guidance:
      "Career goals help SoloOS position you for the roles you actually want.",
  },
  {
    id: 6,
    navTitle: "Review",
    navDescription: "Confirm and unlock",
    eyebrow: "Step 6 / Review",
    title: "Review your profile.",
    subtitle:
      "Confirm everything looks right. The workspace unlocks once your profile reaches 80%.",
    guidance: "Review everything before unlocking the workspace.",
  },
] as const;

export function stepById(id: OnboardingStep): StepDefinition {
  return STEPS[id - 1];
}
