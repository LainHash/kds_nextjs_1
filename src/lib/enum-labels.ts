function lookupLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
  fallback = "—"
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return labels[trimmed.toLowerCase()] ?? trimmed;
}

const BRANCH_STATUS_LABELS: Record<string, string> = {
  active: "Đang hoạt động",
  open: "Đang mở cửa",
  temporarilyclosed: "Tạm đóng cửa",
  maintenance: "Đang bảo trì",
  inactive: "Ngừng hoạt động",
  closed: "Đã đóng cửa",
};

const TABLE_STATUS_LABELS: Record<string, string> = {
  available: "Trống",
  occupied: "Đang phục vụ",
  reserved: "Đã đặt",
  maintenance: "Đang bảo trì",
  inactive: "Ngừng sử dụng",
};

const TABLE_SHAPE_LABELS: Record<string, string> = {
  square: "Bàn vuông",
  rectangle: "Bàn chữ nhật",
  round: "Bàn tròn",
  circle: "Bàn tròn",
  long: "Bàn dài",
  other: "Khác",
};

export function getBranchStatusLabel(status?: string | null): string {
  return lookupLabel(status, BRANCH_STATUS_LABELS);
}

export function getTableStatusLabel(status?: string | null): string {
  return lookupLabel(status, TABLE_STATUS_LABELS);
}

export function getTableShapeLabel(shape?: string | null): string {
  return lookupLabel(shape, TABLE_SHAPE_LABELS);
}

