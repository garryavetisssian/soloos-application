import { workspaceRequest } from "@/lib/workspace/server";
export const GET = (request: Request) => workspaceRequest("jobs", request);
export const POST = (request: Request) => workspaceRequest("jobs", request);
