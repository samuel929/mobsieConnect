export const GLOBAL_DASHBOARD_ROLES = new Set(["Super Admin", "School Owner"]);

export type DashboardRoleAccessPolicy = {
  isGlobal: boolean;
  requiresBranch: boolean;
  requiresTeacherProfile: boolean;
};

/**
 * Access scope is assigned from the Users tab. Only organisation leadership
 * roles may see every campus; every operational/custom role is campus-bound.
 */
export function dashboardRoleAccessPolicy(roleName: string): DashboardRoleAccessPolicy {
  const isGlobal = GLOBAL_DASHBOARD_ROLES.has(roleName);
  return {
    isGlobal,
    requiresBranch: !isGlobal,
    requiresTeacherProfile: roleName === "Teacher",
  };
}

