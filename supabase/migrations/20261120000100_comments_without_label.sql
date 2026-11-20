-- ---------------------------------------------------------------------------------------------
-- A comment is just a comment: it no longer has a kind («Me gustó», «Sugerencia»).
--
-- Nobody can set a label any more, on a new comment or by editing one. The column and the values already stored stay as they are
-- (nothing is lost, and the reply rule that reads it keeps holding), but the site no longer shows them. The landing quotes take the
-- latest top-level comments on games instead of the ones marked «Me gustó».
-- ---------------------------------------------------------------------------------------------

revoke insert (label) on public.comments from authenticated;
revoke update (label) on public.comments from authenticated;
