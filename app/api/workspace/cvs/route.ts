import { workspaceRequest } from "@/lib/workspace/server";
export const GET = (request: Request) => workspaceRequest("cvs", request);
export const POST = (request: Request) => workspaceRequest("cvs", request);
