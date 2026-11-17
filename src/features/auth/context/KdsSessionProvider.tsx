"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { subscribeAuthExpired } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import { KDS_REQUIRED_PERMISSIONS } from "@/lib/constants";
import {
  hasKdsPermission,
  logout as logoutApi,
  resolveBranchAccess,
  type LoginSessionResult,
} from "../services/auth.service";
import type { AuthUser, UserPermissionsResponse } from "../types";
import {
  getAreas,
  getBranchById,
  getRestaurantTables,
} from "@/features/territory/services/territory.service";
import type {
  AreaResponse,
  BranchResponse,
  RestaurantTableResponse,
  TableLookupEntry,
} from "@/features/territory/types";

interface KdsSessionContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  permissions: UserPermissionsResponse | null;
  canUpdatePreparation: boolean;
  isGlobalScope: boolean;
  assignedBranchId: string | null;
  canSwitchBranch: boolean;
  activeBranch: BranchResponse | null;
  areas: AreaResponse[];
  tables: RestaurantTableResponse[];
  tableMap: Record<string, TableLookupEntry>;
  isBranchMetadataLoading: boolean;
  applyLoginSession: (result: LoginSessionResult) => void;
  setActiveBranch: (branch: BranchResponse | null) => void;
  refreshBranchMetadata: (branchId?: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
}

const KdsSessionContext = createContext<KdsSessionContextValue | null>(null);

const emptySubscribe = () => () => {};

function readInitialSessionState(): {
  user: AuthUser | null;
  permissions: UserPermissionsResponse | null;
  activeBranch: BranchResponse | null;
} {
  const token = authStorage.getAccessToken();
  const storedUser = authStorage.getUser();
  if (!token || !storedUser) {
    return { user: null, permissions: null, activeBranch: null };
  }
  const storedPermissions = authStorage.getPermissions();
  const storedBranch = authStorage.getActiveBranch();
  const branchAccess = resolveBranchAccess(storedUser, storedPermissions);

  const sanitizedBranch =
    !branchAccess.canSwitchBranch &&
    branchAccess.assignedBranchId &&
    storedBranch?.id !== branchAccess.assignedBranchId
      ? null
      : storedBranch;

  return {
    user: storedUser,
    permissions: storedPermissions,
    activeBranch: sanitizedBranch,
  };
}

export function KdsSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [sessionState, setSessionState] = useState(readInitialSessionState);
  const [branchMetadata, setBranchMetadata] = useState<{
    branchId: string | null;
    areas: AreaResponse[];
    tables: RestaurantTableResponse[];
  }>({ branchId: null, areas: [], tables: [] });
  const [isBranchMetadataLoading, setIsBranchMetadataLoading] = useState(false);

  const loadBranchMetadata = useCallback(async (branchId: string) => {
    setIsBranchMetadataLoading(true);
    try {
      const [areasRes, tablesRes] = await Promise.all([
        getAreas({ branchId, page: 1, pageSize: 100 }),
        getRestaurantTables({ branchId, page: 1, pageSize: 200 }),
      ]);
      setBranchMetadata({
        branchId,
        areas: areasRes.data ?? [],
        tables: tablesRes.data ?? [],
      });
    } catch {
      setBranchMetadata({ branchId, areas: [], tables: [] });
    } finally {
      setIsBranchMetadataLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAuthExpired(() => {
      setSessionState({ user: null, permissions: null, activeBranch: null });
      setBranchMetadata({ branchId: null, areas: [], tables: [] });
      router.replace("/login");
    });

    return unsubscribe;
  }, [router]);

  const branchAccess = useMemo(
    () => resolveBranchAccess(sessionState.user, sessionState.permissions),
    [sessionState.user, sessionState.permissions]
  );

  const activeBranchId = sessionState.activeBranch?.id ?? null;

  useEffect(() => {
    if (
      !isHydrated ||
      !sessionState.user ||
      branchAccess.canSwitchBranch ||
      !branchAccess.assignedBranchId ||
      activeBranchId === branchAccess.assignedBranchId
    ) {
      return;
    }

    let cancelled = false;
    const syncAssignedBranch = async () => {
      try {
        const res = await getBranchById(branchAccess.assignedBranchId!);
        if (!cancelled && res.data) {
          authStorage.setActiveBranch(res.data);
          setSessionState((prev) => ({ ...prev, activeBranch: res.data ?? null }));
        }
      } catch {
        // Ignore transient errors while resolving assigned branch
      }
    };

    void syncAssignedBranch();

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    sessionState.user,
    branchAccess.canSwitchBranch,
    branchAccess.assignedBranchId,
    activeBranchId,
  ]);

  useEffect(() => {
    if (!isHydrated || !activeBranchId) {
      return;
    }

    let cancelled = false;
    const fetchMetadata = async () => {
      try {
        const [areasRes, tablesRes] = await Promise.all([
          getAreas({ branchId: activeBranchId, page: 1, pageSize: 100 }),
          getRestaurantTables({
            branchId: activeBranchId,
            page: 1,
            pageSize: 200,
          }),
        ]);
        if (!cancelled) {
          setBranchMetadata({
            branchId: activeBranchId,
            areas: areasRes.data ?? [],
            tables: tablesRes.data ?? [],
          });
        }
      } catch {
        if (!cancelled) {
          setBranchMetadata({ branchId: activeBranchId, areas: [], tables: [] });
        }
      } finally {
        if (!cancelled) {
          setIsBranchMetadataLoading(false);
        }
      }
    };

    void fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, activeBranchId]);

  const applyLoginSession = useCallback((result: LoginSessionResult) => {
    setSessionState({
      user: result.user,
      permissions: result.permissions,
      activeBranch: result.defaultBranch,
    });
  }, []);

  const setActiveBranch = useCallback(
    (branch: BranchResponse | null) => {
      if (
        !branchAccess.canSwitchBranch &&
        branchAccess.assignedBranchId &&
        branch?.id !== branchAccess.assignedBranchId
      ) {
        return;
      }

      authStorage.setActiveBranch(branch);
      if (branch) {
        setIsBranchMetadataLoading(true);
      }
      setSessionState((prev) => ({ ...prev, activeBranch: branch }));
    },
    [branchAccess.canSwitchBranch, branchAccess.assignedBranchId]
  );

  const refreshBranchMetadata = useCallback(
    async (branchId?: string) => {
      const targetId = branchId ?? activeBranchId;
      if (!targetId) return;
      await loadBranchMetadata(targetId);
    },
    [activeBranchId, loadBranchMetadata]
  );

  const logout = useCallback(
    async (allDevices = false) => {
      await logoutApi(allDevices);
      setSessionState({ user: null, permissions: null, activeBranch: null });
      setBranchMetadata({ branchId: null, areas: [], tables: [] });
      router.replace("/login");
    },
    [router]
  );

  const user = isHydrated ? sessionState.user : null;
  const permissions = isHydrated ? sessionState.permissions : null;
  const activeBranch = isHydrated ? sessionState.activeBranch : null;

  const areas = useMemo(
    () =>
      activeBranch && branchMetadata.branchId === activeBranch.id
        ? branchMetadata.areas
        : [],
    [activeBranch, branchMetadata]
  );

  const tables = useMemo(
    () =>
      activeBranch && branchMetadata.branchId === activeBranch.id
        ? branchMetadata.tables
        : [],
    [activeBranch, branchMetadata]
  );

  const tableMap = useMemo(() => {
    const map: Record<string, TableLookupEntry> = {};
    for (const table of tables) {
      map[table.id] = {
        id: table.id,
        tableNumber: table.tableNumber,
        areaName: table.areaName,
        status: table.status,
      };
    }
    return map;
  }, [tables]);

  const canUpdatePreparation = useMemo(
    () =>
      hasKdsPermission(
        user,
        permissions,
        KDS_REQUIRED_PERMISSIONS.updatePreparation
      ),
    [user, permissions]
  );

  const value = useMemo<KdsSessionContextValue>(
    () => ({
      isReady: isHydrated,
      isAuthenticated: Boolean(user),
      user,
      permissions,
      canUpdatePreparation,
      isGlobalScope: isHydrated ? branchAccess.isGlobalScope : false,
      assignedBranchId: isHydrated ? branchAccess.assignedBranchId : null,
      canSwitchBranch: isHydrated ? branchAccess.canSwitchBranch : false,
      activeBranch,
      areas,
      tables,
      tableMap,
      isBranchMetadataLoading,
      applyLoginSession,
      setActiveBranch,
      refreshBranchMetadata,
      logout,
    }),
    [
      isHydrated,
      user,
      permissions,
      canUpdatePreparation,
      branchAccess.isGlobalScope,
      branchAccess.assignedBranchId,
      branchAccess.canSwitchBranch,
      activeBranch,
      areas,
      tables,
      tableMap,
      isBranchMetadataLoading,
      applyLoginSession,
      setActiveBranch,
      refreshBranchMetadata,
      logout,
    ]
  );

  return (
    <KdsSessionContext.Provider value={value}>
      {children}
    </KdsSessionContext.Provider>
  );
}

export function useKdsSession(): KdsSessionContextValue {
  const ctx = useContext(KdsSessionContext);
  if (!ctx) {
    throw new Error("useKdsSession must be used within KdsSessionProvider");
  }
  return ctx;
}
