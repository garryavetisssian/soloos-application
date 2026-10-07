import { notFound } from "next/navigation";
import { z } from "zod";
import { CvEditor } from "@/components/workspace/cv-editor";
export default async function CvPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!z.string().uuid().safeParse(id).success) notFound(); return <CvEditor id={id} />; }
