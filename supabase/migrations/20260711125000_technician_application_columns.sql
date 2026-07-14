-- Add email_verification_status and document_status to technician_applications

CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'failed');

ALTER TABLE public.technician_applications
ADD COLUMN email_verification_status public.verification_status NOT NULL DEFAULT 'pending',
ADD COLUMN document_status public.verification_status NOT NULL DEFAULT 'pending';

-- Drop the old submit RPC and recreate it to accommodate future updates if needed, though we don't strictly need to modify its signature unless we want to allow submitting documents directly. For now, we just let them default to 'pending'.
