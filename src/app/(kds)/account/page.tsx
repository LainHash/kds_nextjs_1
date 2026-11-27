"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";
import {
  changeMyPassword,
  getCurrentUser,
  updateMyProfile,
} from "@/features/auth/services/auth.service";
import type { UserDetailResponse } from "@/features/auth/types";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type AccountTab = "profile" | "security" | "permissions";

const emptySubscribe = () => () => {};

function getScopeLabel(scope?: string | null): string {
  switch (scope?.toLowerCase()) {
    case "global":
      return "Toàn hệ thống";
    case "branch":
      return "Chi nhánh";
    case "department":
      return "Phòng ban";
    case "own":
      return "Cá nhân";
    default:
      return scope || "—";
  }
}

export default function KdsAccountPage() {
  const { user, permissions, isGlobalScope, activeBranch, logout } =
    useKdsSession();

  const searchString = useSyncExternalStore(
    emptySubscribe,
    () => window.location.search,
    () => ""
  );
  const [selectedTab, setSelectedTab] = useState<AccountTab | null>(null);

  const tabParam = new URLSearchParams(searchString).get("tab");
  const defaultTab: AccountTab =
    tabParam === "security" || tabParam === "permissions"
      ? tabParam
      : "profile";
  const activeTab: AccountTab = selectedTab ?? defaultTab;

  const [accountDetail, setAccountDetail] = useState<UserDetailResponse | null>(
    null
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("1995-01-01");
  const [gender, setGender] = useState(true);
  const [phone, setPhone] = useState("");
  const [citizenCardId, setCitizenCardId] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("Vietnam");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadMe = async () => {
      setIsLoadingProfile(true);
      try {
        const res = await getCurrentUser();
        if (cancelled) return;
        setAccountDetail(res.data ?? null);
        const profile = res.data?.personalProfile;
        if (profile) {
          setFirstName(profile.firstName ?? "");
          setLastName(profile.lastName ?? "");
          setDateOfBirth((profile.dateOfBirth ?? "1995-01-01").slice(0, 10));
          setGender(Boolean(profile.gender));
          setPhone(profile.phone ?? "");
          setCitizenCardId(profile.citizenCardId ?? "");
          setEmergencyContactName(profile.emergencyContactName ?? "");
          setEmergencyContactPhone(profile.emergencyContactPhone ?? "");
          setStreet(profile.address?.street ?? "");
          setWard(profile.address?.ward ?? "");
          setDistrict(profile.address?.district ?? "");
          setProvince(profile.address?.province ?? "");
          setCountry(profile.address?.country ?? "Vietnam");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Không thể tải thông tin tài khoản hiện tại."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !phone.trim() ||
      !citizenCardId.trim() ||
      !street.trim() ||
      !province.trim()
    ) {
      setErrorMessage(
        "Vui lòng nhập đầy đủ họ tên, số điện thoại, CCCD, địa chỉ đường và tỉnh/thành phố."
      );
      return;
    }

    if (!/^\d{10,15}$/.test(phone.trim())) {
      setErrorMessage("Số điện thoại phải gồm 10 đến 15 chữ số.");
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        gender,
        phone: phone.trim(),
        citizenCardId: citizenCardId.trim(),
        avatarUrl: accountDetail?.personalProfile?.avatarUrl ?? null,
        emergencyContactName: emergencyContactName.trim() || null,
        emergencyContactPhone: emergencyContactPhone.trim() || null,
        address: {
          street: street.trim(),
          ward: ward.trim() || null,
          district: district.trim() || null,
          province: province.trim(),
          country: country.trim() || "Vietnam",
        },
      });
      setSuccessMessage("Đã cập nhật hồ sơ cá nhân thành công.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Không thể cập nhật hồ sơ cá nhân."
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Vui lòng nhập đầy đủ các trường mật khẩu.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword === oldPassword) {
      setErrorMessage("Mật khẩu mới không được trùng mật khẩu hiện tại.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeMyPassword({
        oldPassword,
        newPassword,
        confirmPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Đã đổi mật khẩu thành công.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Không thể đổi mật khẩu."
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      await logout(true);
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Thông tin tài khoản &amp; Bảo mật (KDS)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý hồ sơ cá nhân, đổi mật khẩu và xem quyền hạn nhân sự bếp/bar hiện tại.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
            {accountDetail?.userName ?? user?.userName ?? "—"} (
            {accountDetail?.email ?? user?.email ?? "—"})
          </span>
          {activeBranch && (
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-semibold text-amber-700 ring-1 ring-amber-200">
              Chi nhánh: {activeBranch.code}
            </span>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {(
          [
            { key: "profile", label: "Hồ sơ cá nhân" },
            { key: "security", label: "Mật khẩu & Thiết bị" },
            { key: "permissions", label: "Quyền hạn hiện tại" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setSelectedTab(tab.key);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-semibold transition",
              activeTab === tab.key
                ? "border-amber-600 text-amber-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <form
          onSubmit={handleSaveProfile}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {isLoadingProfile ? (
            <p className="text-sm text-slate-500">Đang tải hồ sơ...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Họ &amp; tên đệm
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tên
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Giới tính
                  </label>
                  <select
                    value={gender ? "male" : "female"}
                    onChange={(e) => setGender(e.target.value === "male")}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    value={citizenCardId}
                    onChange={(e) => setCitizenCardId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Địa chỉ đường / số nhà
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Phường / Xã
                  </label>
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Quận / Huyện
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tỉnh / Thành phố
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Quốc gia
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Người liên hệ khẩn cấp (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    SĐT liên hệ khẩn cấp (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSavingProfile ? "Đang lưu..." : "Lưu hồ sơ cá nhân"}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {activeTab === "security" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleChangePassword}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-bold text-slate-900">Đổi mật khẩu</h2>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Mật khẩu mới
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isChangingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}
            </button>
          </form>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Phiên đăng nhập &amp; Thiết bị
            </h2>
            <p className="text-sm text-slate-600">
              Thu hồi toàn bộ refresh token đang hoạt động trên tất cả các thiết bị khác (POS, KDS, cổng quản trị).
            </p>
            {!confirmLogoutAll ? (
              <button
                type="button"
                onClick={() => setConfirmLogoutAll(true)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Đăng xuất khỏi mọi thiết bị
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-medium text-rose-800">
                  Bạn sẽ bị đăng xuất khỏi tất cả phiên đang mở và phải đăng nhập lại. Tiếp tục?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isLoggingOutAll}
                    onClick={() => void handleLogoutAll()}
                    className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isLoggingOutAll ? "Đang xử lý..." : "Xác nhận đăng xuất tất cả"}
                  </button>
                  <button
                    type="button"
                    disabled={isLoggingOutAll}
                    onClick={() => setConfirmLogoutAll(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700 ring-1 ring-indigo-200">
              Role: {user?.role ?? "—"}
            </span>
            <span
              className={cn(
                "rounded-md px-2.5 py-1 ring-1",
                isGlobalScope
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200"
              )}
            >
              Phạm vi:{" "}
              {getScopeLabel(
                permissions?.defaultDataScope ?? user?.defaultDataScope
              )}
            </span>
            {user?.organization?.employeeCode && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                Mã NV: {user.organization.employeeCode}
              </span>
            )}
            {user?.organization?.departmentName && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                Phòng ban: {user.organization.departmentName}
              </span>
            )}
            {user?.organization?.positionName && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                Chức vụ: {user.organization.positionName}
              </span>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Quyền được cấp ({permissions?.grants.length ?? 0})
            </h3>
            {!permissions?.grants.length ? (
              <p className="text-sm text-slate-500">
                Quyền được xác định theo vai trò {user?.role}.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-left font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Permission Code</th>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Scope</th>
                      <th className="px-3 py-2">Policy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissions.grants.map((g, idx) => (
                      <tr key={`${g.permission}-${idx}`}>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                          {g.permission}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {g.serviceName}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                            {getScopeLabel(g.scope)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {g.sourcePolicyCode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

