import { CvLibrary } from "@/components/workspace/cv-library";
import { getCurrentProfile } from "@/lib/profile";
export default async function CvsPage() { return <CvLibrary profile={await getCurrentProfile()} />; }
