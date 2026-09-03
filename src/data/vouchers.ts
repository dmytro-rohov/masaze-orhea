import { voucherMassages, type MassageId } from "@/data/massages";

export type VoucherConfig = {
  id: `voucher-${MassageId}`;
  massageId: MassageId;
  type: "massage" | "vip";
};

export const vouchers: VoucherConfig[] = voucherMassages.map(
  (massage): VoucherConfig => ({
    id: `voucher-${massage.id}`,
    massageId: massage.id,
    type: massage.zoneId === "vip" ? "vip" : "massage",
  }),
);
