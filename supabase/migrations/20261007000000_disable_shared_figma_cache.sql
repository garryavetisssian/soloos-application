-- Quarantine existing client-writable shared entries; preserve the data.
DROP POLICY IF EXISTS "authenticated read figma cache" ON public.figma_file_cache;
DROP POLICY IF EXISTS "authenticated write figma cache" ON public.figma_file_cache;
DROP POLICY IF EXISTS "authenticated update figma cache" ON public.figma_file_cache;
REVOKE ALL ON TABLE public.figma_file_cache FROM anon, authenticated;
-- Re-enable only with server-owned writes and per-file access checks.
