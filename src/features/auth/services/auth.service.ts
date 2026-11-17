import { apiFetch, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import {
  API_ENDPOINTS,
  KDS_REQUIRED_PERMISSIONS,
  KDS_STAFF_ROLES,
} from "@/lib/constants";
import { getBranchById } from "@/features/territory/services/territory.service";
import type { BranchResponse } from "@/features/territory/types";
import type { ApiResult } from "@/types/api";
import type {
  AuthenticationResponse,
  AuthUser,
  EmployeeResponse,
  LoginRequest,
  UserPermissionsResponse,
} from "../types";

export interface LoginSessionResult {
  user: AuthUser;
  permissions: UserPermissionsResponse | null;
  defaultBranch: BranchResponse | null;
}

export interface BranchAccessPolicy {
  isGlobalScope: boolean;
  assignedBranchId: string | null;
  canSwitchBranch: boolean;
}

export function resolveBranchAccess(
  user: AuthUser | null,
  permissions: UserPermissionsResponse | null
): BranchAccessPolicy {
  if (!user) {
    return {
      isGlobalScope: false,
      assignedBranchId: null,
      canSwitchBranch: false,
    };
  }

  const normalizedRole = user.role.toLowerCase();
  const isAdminRole =
    normalizedRole === "superadmin" || normalizedRole === "admin";

  const scopeValue = (
    permissions?.defaultDataScope ??
    user.defaultDataScope ??
    ""
  ).toLowerCase();

  const hasGlobalKdsGrant = Boolean(
    permissions?.grants.some(
      (grant) =>
        grant.scope.toLowerCase() === "global" &&
        (grant.permission === KDS_REQUIRED_PERMISSIONS.updatePreparation ||
          grant.permission === KDS_REQUIRED_PERMISSIONS.readPreparation ||
          grant.permission === KDS_REQUIRED_PERMISSIONS.readOrders)
    )
  );

  const isGlobalScope =
    isAdminRole || scopeValue === "global" || hasGlobalKdsGrant;

  const assignedBranchId =
    permissions?.organization?.branchPublicId ??
    user.organization?.branchPublicId ??
    null;

  return {
    isGlobalScope,
    assignedBranchId,
    canSwitchBranch: isGlobalScope || !assignedBranchId,
  };
}

export function hasKdsPermission(
  user: AuthUser | null,
  permissions: UserPermissionsResponse | null,
  permissionCode: string
): boolean {
  if (!user) return false;

  const isSuperOrAdmin =
    user.role === "Superadmin" ||
    user.role === "SuperAdmin" ||
    user.role === "Admin";
  if (isSuperOrAdmin) {
    return true;
  }

  if (!permissions) {
    return KDS_STAFF_ROLES.includes(
      user.role as (typeof KDS_STAFF_ROLES)[number]
    );
  }

  if (permissions.deniedPermissions.includes(permissionCode)) {
    return false;
  }

  return permissions.grants.some((grant) => grant.permission === permissionCode);
}

export function canAccessKds(
  user: AuthUser | null,
  permissions: UserPermissionsResponse | null
): boolean {
  if (!user) return false;

  const hasStaffRole = KDS_STAFF_ROLES.some(
    (role) => role.toLowerCase() === user.role.toLowerCase()
  );

  if (
    hasKdsPermission(user, permissions, KDS_REQUIRED_PERMISSIONS.updatePreparation) ||
    hasKdsPermission(user, permissions, KDS_REQUIRED_PERMISSIONS.readPreparation) ||
    hasKdsPermission(user, permissions, KDS_REQUIRED_PERMISSIONS.readOrders)
  ) {
    return true;
  }

  return hasStaffRole;
}

export async function getMyPermissions(): Promise<UserPermissionsResponse | null> {
  const result = await apiFetch<ApiResult<UserPermissionsResponse>>(
    API_ENDPOINTS.identity.mePermissions
  );
  return result.data ?? null;
}

export async function getEmployeeByUserId(
  userId: string
): Promise<EmployeeResponse | null> {
  try {
    const result = await apiFetch<ApiResult<EmployeeResponse>>(
      API_ENDPOINTS.identity.employeeByUser(userId)
    );
    return result.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function login(payload: LoginRequest): Promise<LoginSessionResult> {
  const result = await apiFetch<ApiResult<AuthenticationResponse>>(
    API_ENDPOINTS.identity.login,
    {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefresh: true,
    }
  );

  const authData = result.data;
  if (!authData?.accessToken) {
    throw new ApiError("Phản hồi đăng nhập không hợp lệ.", 500);
  }

  authStorage.setTokens(authData.accessToken, authData.refreshToken);

  const user: AuthUser = {
    userId: authData.userId,
    userName: authData.userName,
    email: authData.email,
    role: authData.role,
    permissionVersion: authData.permissionVersion,
    defaultDataScope: authData.defaultDataScope,
    organization: authData.organization,
  };
  authStorage.setUser(user);

  let permissions: UserPermissionsResponse | null = null;
  try {
    permissions = await getMyPermissions();
    if (permissions) {
      authStorage.setPermissions(permissions);
    }
  } catch {
    // Allow login to continue with JWT claims if permission endpoint is temporarily unavailable
  }

  if (!canAccessKds(user, permissions)) {
    authStorage.clearAll();
    throw new ApiError(
      "Tài khoản không có quyền truy cập màn hình bếp (KDS).",
      403
    );
  }

  let branchId =
    permissions?.organization?.branchPublicId ??
    user.organization?.branchPublicId ??
    null;

  if (!branchId) {
    try {
      const employee = await getEmployeeByUserId(user.userId);
      branchId = employee?.branchPublicId ?? null;
    } catch {
      branchId = null;
    }
  }

  let defaultBranch: BranchResponse | null = null;
  if (branchId) {
    try {
      const branchRes = await getBranchById(branchId);
      defaultBranch = branchRes.data ?? null;
      authStorage.setActiveBranch(defaultBranch);
    } catch {
      authStorage.setActiveBranch(null);
      defaultBranch = null;
    }
  } else {
    authStorage.setActiveBranch(null);
  }

  return {
    user,
    permissions,
    defaultBranch,
  };
}

export async function logout(allDevices = false): Promise<void> {
  const refreshToken = authStorage.getRefreshToken();
  try {
    if (allDevices) {
      await apiFetch(API_ENDPOINTS.identity.logoutAll, {
        method: "POST",
        skipRefresh: true,
      });
    } else if (refreshToken) {
      await apiFetch(API_ENDPOINTS.identity.logout, {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipRefresh: true,
      });
    }
  } catch {
    // Clear local session even if server logout fails
  } finally {
    authStorage.clearAll();
  }
}

