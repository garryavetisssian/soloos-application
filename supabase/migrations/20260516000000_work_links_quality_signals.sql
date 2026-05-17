-- Per-link quality signals captured at validation time. Used to
-- compute a content-grounded quality score on the Portfolio page
-- without re-fetching the source on every render.
--
-- Shape (variable, gated by `kind`):
--   {
--     "kind": "figma",
--     "thumbBytes":      <number>,   -- size of the downloaded preview
--     "pageCount":       <number>,
--     "frameCount":      <number>,   -- all FRAME/COMPONENT/SECTION nodes
--     "namedFrameCount": <number>,   -- non-default names only
--     "componentCount":  <number>,
--     "styleCount":      <number>,
--     "textLayerCount":  <number>,
--     "imageFillCount":  <number>
--   }
--
-- Other link types will populate richer signals over time. Until they
-- do, the column stays null and we fall back to metadata-based scoring.

alter table public.work_links
  add column if not exists quality_signals jsonb;
