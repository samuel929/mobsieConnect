export const schoolTypes = ['PRIVATE_PRESCHOOL', 'CHILD_DAY_CARE', 'NPO_PRESCHOOL'] as const;

export const schoolStages = ['STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'GRADE_R'] as const;

export type SchoolType = (typeof schoolTypes)[number];
export type SchoolStage = (typeof schoolStages)[number];

/** The GDE-aligned stages shown consistently in the dashboard and parent app. */
export const stageDetails: Record<SchoolStage, {
  label: string;
  gradeCode: string;
  ageRange: string;
  className: string;
}> = {
  STAGE_1: { label: 'Stage 1', gradeCode: '0000', ageRange: '6–18 months', className: 'Bambino Class' },
  STAGE_2: { label: 'Stage 2', gradeCode: '000', ageRange: '2–3 years', className: 'Shapes Class' },
  STAGE_3: { label: 'Stage 3', gradeCode: '00', ageRange: '3–4 years', className: 'Colours Class' },
  STAGE_4: { label: 'Stage 4', gradeCode: '0', ageRange: '4–5 years', className: 'Alphabets Class' },
  GRADE_R: { label: 'Grade R', gradeCode: 'R', ageRange: '5–6 years', className: 'Numbers Class' },
};

export const branchCodes: Record<string, string> = {
  soshanguve: 'S1', mamelodi: 'M1', thembisa: 'T1', tembisa: 'T1',
  skycity: 'SC1', hebron: 'H1', soweto: 'S2', cosmocity: 'C1',
};

export const schoolFeesBanking = {
  bank: 'FNB', accountName: 'Mobsie Kids',
  accountsByBranchCode: {
    S1: '63115075920', S2: '63115075920', M1: '63114977036',
    C1: '63115074394', SC1: '63115075508',
  } as Record<string, string>,
  referenceHint: 'Use the child reference number or full name as payment reference.',
  supportPhone: '065 737 8254', supportEmail: 'operations@mobsiekids.co.za',
} as const;

export const uniformBanking = {
  bank: 'ABSA', accountName: 'Mobsie Kids', accountNumber: '4103226260',
  referenceHint: 'Use the child reference number or full name as payment reference.',
  supportPhone: '065 737 8254', supportEmail: 'operations@mobsiekids.co.za',
} as const;

/** Transport payments are payable to Mobsie Properties. */
export const transportBanking = {
  bank: 'ABSA', accountName: 'Mobsie Properties', accountNumber: '4103226260',
  referenceHint: 'Use the child reference number or full name as payment reference.',
  supportPhone: '063 704 6734', supportEmail: 'operations@mobsiekids.co.za',
} as const;

type Pricing = {
  applicationFeeCents: number;
  acceptanceFeeCents: number;
  stageFeesCents: Record<SchoolStage, number>;
};

const pricing: Record<SchoolType, Pricing> = {
  PRIVATE_PRESCHOOL: {
    applicationFeeCents: 50_000,
    acceptanceFeeCents: 130_000,
    stageFeesCents: {
      STAGE_1: 185_000,
      STAGE_2: 185_000,
      STAGE_3: 175_000,
      STAGE_4: 170_000,
      GRADE_R: 170_000,
    },
  },
  CHILD_DAY_CARE: {
    applicationFeeCents: 95_000,
    acceptanceFeeCents: 0,
    stageFeesCents: {
      STAGE_1: 100_000,
      STAGE_2: 95_000,
      STAGE_3: 95_000,
      STAGE_4: 90_000,
      GRADE_R: 90_000,
    },
  },
  NPO_PRESCHOOL: {
    applicationFeeCents: 55_000,
    acceptanceFeeCents: 0,
    stageFeesCents: {
      STAGE_1: 85_000,
      STAGE_2: 80_000,
      STAGE_3: 80_000,
      STAGE_4: 75_000,
      GRADE_R: 75_000,
    },
  },
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');

export function availableSchoolTypes(branchName: string): SchoolType[] {
  const branch = normalize(branchName);
  if (branch.includes('hebron')) return ['NPO_PRESCHOOL'];
  if (branch.includes('soweto') || branch.includes('tembisa') || branch.includes('thembisa')) {
    return ['PRIVATE_PRESCHOOL'];
  }
  return ['PRIVATE_PRESCHOOL', 'CHILD_DAY_CARE'];
}

export function branchCode(branchName: string) {
  const normalized = normalize(branchName);
  const key = Object.keys(branchCodes).find((candidate) => normalized.includes(candidate));
  return key ? branchCodes[key] : normalized.slice(0, 4).toUpperCase();
}

export function bankingForBranch(branchName: string) {
  const code = branchCode(branchName);
  return { ...schoolFeesBanking, branchCode: code, accountNumber: schoolFeesBanking.accountsByBranchCode[code] ?? null };
}

export function schoolPrice(schoolType: SchoolType, schoolStage: SchoolStage) {
  const selected = pricing[schoolType];
  return {
    applicationFeeCents: selected.applicationFeeCents,
    acceptanceFeeCents: selected.acceptanceFeeCents,
    monthlyFeeCents: selected.stageFeesCents[schoolStage],
  };
}
