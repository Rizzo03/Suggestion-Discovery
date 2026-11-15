-- Keep existing MP3 recordings; new WAV recordings contain a 3-second silent lead-in.
update storage.buckets set allowed_mime_types = array['audio/mpeg','audio/wav']
where id = 'suggestion-audio';
