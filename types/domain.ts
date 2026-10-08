export type Role = "PRINCIPAL" | "TEACHER";

export type SessionUser = {
  id: string;
  tenantId: string;
  branchId: string | null;
  email: string;
  name: string;
  role: Role;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: {
    nextCursor?: string | null;
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Branch = {
  id: string;
  name: string;
  slug: string;
  city: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  imageUrl: string | null;
  principalName: string | null;
  principalPhone: string | null;
  learnerCount: number;
  teacherCount: number;
  attendanceRate: number;
  status: "ACTIVE" | "COMING_SOON" | "INACTIVE";
  createdAt: string;
};

export type TeamMember = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  title: string;
  bio: string | null;
  yearsExperience: number;
  imageUrl: string;
  isPrincipal: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
};
