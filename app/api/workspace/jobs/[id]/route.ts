import { workspaceRequest } from "@/lib/workspace/server";
type Context = { params: Promise<{ id: string }> };
async function handle(request: Request, context: Context) { return workspaceRequest("jobs", request, (await context.params).id); }
export const GET = handle;
export const PUT = handle;
export const DELETE = handle;
