UPDATE applications
SET status='WAITLISTED'::application_status,updated_at=now()
WHERE status='REJECTED'::application_status;
