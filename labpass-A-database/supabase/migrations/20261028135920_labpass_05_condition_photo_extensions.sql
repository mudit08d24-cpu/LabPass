-- Condition photos: images only, checked by file extension as well as by the bucket's MIME allow-list.
-- Blocks direct uploads (bypassing the app's helper) of PDFs or other files into condition-photos;
-- certificates (which may be PDFs) live in their own bucket.
alter policy lp_condition_photos_insert on storage.objects
  with check (bucket_id = 'condition-photos'
              and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
              and public.can_upload_booking_evidence(public.uuid_or_null((storage.foldername(name))[1])));
