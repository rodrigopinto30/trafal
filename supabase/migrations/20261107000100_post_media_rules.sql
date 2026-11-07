-- Trafal · Post media rules
--
-- The files of an update (images, GIFs, short MP4 videos) go through the app server, which inspects the bytes before storing
-- them. The database keeps the last word on what a row may say:
--   * the stored path must be inside the folder of that very post, with a random name and an allowed extension (nobody can
--     point a file at another post's folder, another bucket folder or an external URL);
--   * the kind, the MIME type and the extension agree with each other;
--   * the size cap depends on the kind: images 5 MiB, GIFs 8 MiB, videos 20 MiB.

alter table public.post_media
  add constraint post_media_path_fmt
  check (path ~ ('^posts/' || post_id::text || '/[0-9a-f]{32}\.(webp|jpg|png|gif|mp4|webm)$')),
  add constraint post_media_kind_matches_mime
  check (
    (kind = 'image' and mime in ('image/png', 'image/jpeg', 'image/webp'))
    or (kind = 'gif' and mime = 'image/gif')
    or (kind = 'video' and mime in ('video/mp4', 'video/webm'))
  ),
  add constraint post_media_ext_matches_mime
  check (
    (mime = 'image/png' and path like '%.png')
    or (mime = 'image/jpeg' and path like '%.jpg')
    or (mime = 'image/webp' and path like '%.webp')
    or (mime = 'image/gif' and path like '%.gif')
    or (mime = 'video/mp4' and path like '%.mp4')
    or (mime = 'video/webm' and path like '%.webm')
  ),
  add constraint post_media_bytes_by_kind
  check (
    (kind = 'image' and bytes <= 5242880)
    or (kind = 'gif' and bytes <= 8388608)
    or (kind = 'video' and bytes <= 20971520)
  );
