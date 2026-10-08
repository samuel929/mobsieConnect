CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('PRINCIPAL', 'TEACHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE branch_status AS ENUM ('ACTIVE', 'COMING_SOON', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'DRAFT', 'PENDING_REVIEW', 'DOCUMENTS_REQUIRED', 'INTERVIEW_SCHEDULED',
    'APPROVED', 'REJECTED', 'WAITLISTED', 'ENROLLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE document_kind AS ENUM (
    'BIRTH_CERTIFICATE', 'IMMUNIZATION_RECORD', 'PARENT_ID',
    'PROOF_OF_ADDRESS', 'PREVIOUS_REPORT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  email citext NOT NULL,
  image_url text,
  image_public_id text,
  principal_name text,
  principal_email citext,
  principal_phone text,
  learner_count integer NOT NULL DEFAULT 0 CHECK (learner_count >= 0),
  teacher_count integer NOT NULL DEFAULT 0 CHECK (teacher_count >= 0),
  attendance_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (attendance_rate BETWEEN 0 AND 100),
  status branch_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  email citext NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text NOT NULL,
  bio text,
  years_experience integer NOT NULL DEFAULT 0 CHECK (years_experience BETWEEN 0 AND 80),
  image_url text NOT NULL,
  image_public_id text NOT NULL,
  is_principal boolean NOT NULL DEFAULT false,
  contact_email citext,
  contact_phone text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference text NOT NULL,
  access_token_hash text NOT NULL,
  parent_name text NOT NULL,
  parent_email citext NOT NULL,
  parent_phone text NOT NULL,
  relationship text NOT NULL,
  child_name text NOT NULL,
  child_date_of_birth date NOT NULL,
  child_gender text NOT NULL CHECK (child_gender IN ('BOY', 'GIRL', 'OTHER')),
  current_grade text NOT NULL,
  status application_status NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference)
);

CREATE TABLE IF NOT EXISTS application_preferences (
  application_id uuid PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id),
  reason text,
  preferred_start_date date NOT NULL,
  enrollment_type text NOT NULL CHECK (enrollment_type IN ('FULL_TIME', 'PART_TIME')),
  aftercare_requested boolean NOT NULL DEFAULT false,
  previous_school text,
  attended_preschool boolean NOT NULL,
  allergies text,
  emergency_contact_name text NOT NULL,
  emergency_contact_phone text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind document_kind NOT NULL,
  file_url text NOT NULL,
  public_id text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind)
);

CREATE TABLE IF NOT EXISTS application_consents (
  application_id uuid PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  information_accurate boolean NOT NULL DEFAULT false,
  privacy_accepted boolean NOT NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  ip_address inet,
  user_agent text
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id),
  application_id uuid UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
  name text NOT NULL,
  date_of_birth date NOT NULL,
  grade text NOT NULL,
  class_name text NOT NULL,
  parent_name text NOT NULL,
  attendance_rate numeric(5,2) NOT NULL DEFAULT 0,
  enrollment_status text NOT NULL DEFAULT 'ENROLLED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject text NOT NULL,
  term smallint NOT NULL CHECK (term BETWEEN 1 AND 4),
  year smallint NOT NULL CHECK (year BETWEEN 2020 AND 2200),
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  grade text NOT NULL,
  teacher_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject, term, year)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  audience text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS audit_log_default PARTITION OF audit_log DEFAULT;

CREATE INDEX IF NOT EXISTS idx_branches_tenant_status
  ON branches (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_tenant_branch_order
  ON team_members (tenant_id, branch_id, display_order, id);
CREATE INDEX IF NOT EXISTS idx_applications_tenant_status_created
  ON applications (tenant_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_applications_parent_email
  ON applications (tenant_id, parent_email);
CREATE INDEX IF NOT EXISTS idx_applications_search
  ON applications USING gin (to_tsvector('simple', child_name || ' ' || parent_name || ' ' || reference));
CREATE INDEX IF NOT EXISTS idx_students_tenant_branch_created
  ON students (tenant_id, branch_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_students_search
  ON students USING gin (to_tsvector('simple', name || ' ' || parent_name || ' ' || grade));
CREATE INDEX IF NOT EXISTS idx_academics_tenant_student_year_term
  ON academic_records (tenant_id, student_id, year DESC, term DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_starts
  ON calendar_events (tenant_id, starts_at, id);
CREATE INDEX IF NOT EXISTS idx_events_branch_starts
  ON calendar_events (branch_id, starts_at) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_application
  ON application_documents (application_id, kind);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created
  ON audit_log (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'branches', 'users', 'team_members', 'applications', 'students',
    'academic_records', 'calendar_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name, table_name
    );
  END LOOP;
END $$;
