import { z } from "zod";

const phone = z.string().trim().min(8).max(24);
const nullableUrl = z.string().url().nullable().optional();
const optionalPersonName = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(2).max(120).optional(),
);

export const loginSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const parentSignupSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  phone,
  password: z.string().min(8).max(128),
});

export const parentLoginSchema = z.object({
  tenantId: z.uuid(),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const parentProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  phone,
});

/** Principal-managed parent directory records. */
export const adminParentSchema = parentProfileSchema.extend({
  branchId: z.string().uuid("Select a campus."),
});

export const branchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  address: z.string().trim().min(10).max(300),
  phone,
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  imageUrl: nullableUrl,
  imageData: z.string().startsWith("data:image/").max(8_000_000),
  principalName: z.string().trim().min(2).max(100),
  principalEmail: z.email().max(254),
  principalPhone: phone,
  status: z.enum(["ACTIVE", "COMING_SOON", "INACTIVE"]).default("ACTIVE"),
});

export const branchUpdateSchema = branchSchema.partial().extend({
  id: z.uuid(),
});

export const teamMemberSchema = z.object({
  branchId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(1000).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(80),
  isPrincipal: z.boolean().default(false),
  contactEmail: z.email().max(254).optional().or(z.literal("")),
  contactPhone: z.string().max(24).optional(),
  imageData: z.string().startsWith("data:image/").max(8_000_000),
});

export const teamMemberUpdateSchema = teamMemberSchema.partial().extend({
  id: z.uuid(),
});

/** Dashboard learner management. Kept separate from application onboarding. */
export const studentSchema = z.object({
  branchId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  dateOfBirth: z.iso.date(),
  grade: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(80),
  parentName: z.string().trim().min(2).max(120),
  attendanceRate: z.coerce.number().min(0).max(100).default(100),
  enrollmentStatus: z.string().trim().min(1).max(50).default("ENROLLED"),
});

export const studentUpdateSchema = studentSchema.partial().extend({
  id: z.uuid(),
});

export const applicationSchema = z.object({
  applicationType: z.enum(["NEW", "REREGISTRATION"]).default("NEW"),
  parentName: z.string().trim().min(2).max(120),
  parentEmail: z.email().max(254),
  parentPhone: phone,
  relationship: z.enum(["Mother", "Father", "Guardian", "Other"]),
  childName: z.string().trim().min(2).max(120),
  childDateOfBirth: z.iso.date(),
  childGender: z.enum(["BOY", "GIRL", "OTHER"]),
  currentGrade: z.string().trim().min(2).max(50),
  childHasDisability: z.boolean().default(false),
  disabilityDetails: z.string().trim().max(2000).optional(),
});

export const preferencesSchema = z.object({
  branchId: z.uuid(),
  reason: z.string().trim().max(1000).optional(),
  schoolType: z.enum(["PRIVATE_PRESCHOOL", "CHILD_DAY_CARE", "NPO_PRESCHOOL"]),
  schoolStage: z.enum(["STAGE_1", "STAGE_2", "STAGE_3", "STAGE_4", "GRADE_R"]),
  preferredStartDate: z.iso.date(),
  enrollmentType: z.enum(["FULL_TIME", "PART_TIME"]),
  aftercareRequested: z.boolean().default(false),
  previousSchool: z.string().trim().min(2).max(160),
  previousSchoolPhone: phone,
  referralSource: z.enum(["SOCIAL_MEDIA", "WORD_OF_MOUTH", "RADIO"]),
  attendedPreschool: z.boolean(),
  allergies: z.string().trim().max(1000).optional(),
  emergencyContactName: z.string().trim().min(2).max(120),
  emergencyContactPhone: phone,
  // These details are collected on the review-and-submit screen, after Step 2
  // has already been saved. Final submission validates that all three are set.
  feePayerFirstName: optionalPersonName,
  feePayerLastName: optionalPersonName,
  feePayerTermsAccepted: z.boolean().default(false),
});

export const consentSchema = z.object({
  informationAccurate: z.literal(true),
  privacyAccepted: z.literal(true),
  termsAccepted: z.literal(true),
  enrolmentTermsAccepted: z.literal(true),
  submit: z.boolean().default(false),
});

export const documentSchema = z.object({
  kind: z.enum([
    "LEARNER_PHOTO",
    "BIRTH_CERTIFICATE",
    "PARENT_ID",
    "MEDICAL_AID",
    "CLINIC_CARD",
    "PROOF_OF_INCOME",
    "IMMUNIZATION_RECORD",
    "PROOF_OF_ADDRESS",
    "PREVIOUS_REPORT",
    "FEE_PAYER_ID",
    "PROOF_OF_PAYMENT",
  ]),
  originalName: z.string().trim().min(1).max(200),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  fileData: z.string().startsWith("data:").max(12_000_000),
});

export const eventSchema = z
  .object({
    branchId: z.uuid().nullable().optional(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).optional(),
    category: z.enum(["SCHOOL_EVENT", "ACADEMIC", "HOLIDAY", "MEETING", "SPORT"]),
    audience: z.enum(["ALL", "PARENTS", "TEACHERS", "BRANCH"]),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    allDay: z.boolean().default(false),
  })
  .refine((value) => new Date(value.endsAt) >= new Date(value.startsAt), {
    path: ["endsAt"],
    message: "End time must be after the start time.",
  });

export const attendanceRegisterSchema = z.object({
  branchId: z.uuid(),
  attendanceDate: z.iso.date(),
  entries: z.array(z.object({
    studentId: z.uuid(),
    status: z.enum(["PRESENT", "ABSENT"]),
  })).min(1).max(500),
});

export const shopProductSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(160),
  category: z.enum(["Uniform", "Stationery", "Accessories", "Books"]),
  price: z.coerce.number().min(0).max(1_000_000),
  stock: z.coerce.number().int().min(0).max(10_000_000),
  status: z.enum(["ACTIVE", "HIDDEN", "OUT_OF_STOCK"]).default("ACTIVE"),
  imageData: z.string().startsWith("data:image/").max(8_000_000).optional(),
});

export const shopOrderStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["PROCESSING", "READY_FOR_COLLECTION", "COLLECTED", "CANCELLED"]),
});

export const stockAdjustmentSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(-10_000_000).max(10_000_000).refine((value) => value !== 0),
});

/**
 * Schemas used by the parent mobile API. Keep these exports in this shared
 * module: API routes must never call `.parse()` on an undefined import.
 */
export const mobileEnrollmentSchema = z.object({
  applicationId: z.uuid(),
  pickupPassword: z.string().trim().min(4).max(128),
  primaryCollector: z.string().trim().min(2).max(120),
  secondaryCollector: z.string().trim().min(2).max(120).optional().or(z.literal("")),
});

export const mobileFeedbackSchema = z.object({
  category: z.enum(["SUGGESTION", "INCIDENT", "RATING", "GENERAL"]),
  message: z.string().trim().min(2).max(4_000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const mobileMessageSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});

export const mobileOrderSchema = z.object({
  branchId: z.uuid().nullable().optional(),
  items: z.array(z.object({
    productId: z.uuid(),
    quantity: z.coerce.number().int().min(1).max(100),
  })).min(1).max(100),
});

export const consentCompletionSchema = z.object({
  studentId: z.uuid().nullable().optional(),
  childName: z.string().trim().min(2).max(120),
  guardianName: z.string().trim().min(2).max(120),
  guardianId: z.string().trim().min(4).max(80),
  signature: z.string().trim().min(2).max(160),
  signedAt: z.string().trim().max(100).optional(),
  documentHtml: z.string().trim().min(50).max(300_000).optional(),
});

export const mobileDeregistrationSchema = z.object({
  studentId: z.uuid(),
  lastDayOfAttendance: z.iso.date(),
  reason: z.enum(['MOVING_SCHOOLS', 'RELOCATING', 'FINANCIAL_REASONS', 'PERSONAL_REASONS', 'OTHER']),
  comments: z.string().trim().max(2_000).optional(),
  noticeAccepted: z.literal(true),
});

export const pushTokenSchema = z.object({
  token: z.string().trim().regex(/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/, 'A valid Expo push token is required.'),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().trim().min(8).max(200),
  preferences: z.object({
    enabled: z.boolean().default(true),
    announcements: z.boolean().default(true),
    attendance: z.boolean().default(true),
    messages: z.boolean().default(true),
  }).optional(),
});

export const notificationCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(1_000),
  audience: z.enum(['ALL_PARENTS', 'BRANCH']).default('ALL_PARENTS'),
  branchId: z.uuid().nullable().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const dailyActivitySchema = z.object({
  branchId: z.uuid(),
  className: z.string().trim().min(1).max(100),
  activityDate: z.iso.date(),
  activityType: z.string().trim().min(1).max(60).default('CUSTOM'),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1_000).optional().nullable(),
  icon: z.string().trim().min(2).max(80).default('calendar-outline'),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default('#DFF5E6'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const dailyActivityUpdateSchema = dailyActivitySchema.partial().extend({ id: z.uuid() });
