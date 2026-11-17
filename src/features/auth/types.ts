export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface UserOrganizationContext {
  employeeId: string;
  employeeCode: string;
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  positionId?: string | null;
  positionCode?: string | null;
  positionName?: string | null;
  seniorityLevel: number;
  branchPublicId?: string | null;
  status: string;
  inheritedPositionCodes: string[];
}

export interface AuthenticationResponse {
  userId: string;
  userName: string;
  email: string;
  role: string;
  permissionVersion?: string | null;
  defaultDataScope?: string | null;
  organization?: UserOrganizationContext | null;
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  userId: string;
  userName: string;
  email: string;
  role: string;
  permissionVersion?: string | null;
  defaultDataScope?: string | null;
  organization?: UserOrganizationContext | null;
}

export interface PermissionGrant {
  permission: string;
  name: string;
  serviceName: string;
  resource: string;
  action: string;
  scope: string;
  targetBranchPublicId?: string | null;
  conditionJson?: string | null;
  sourcePolicyCode: string;
}

export interface UserPermissionsResponse {
  userId: string;
  userName: string;
  email: string;
  role: string;
  permissionVersion: string;
  defaultDataScope: string;
  organization?: UserOrganizationContext | null;
  grants: PermissionGrant[];
  deniedPermissions: string[];
}

export interface EmployeeResponse {
  id: string;
  code: string;
  positionName: string;
  positionCode: string;
  branchPublicId?: string | null;
  hireDate: string;
  terminationDate?: string | null;
  status: string;
}
