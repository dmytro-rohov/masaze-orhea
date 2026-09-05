import { voucherMassages, type MassageId } from "@/data/massages";

export type VoucherConfig =
  | {
      id: `voucher-${MassageId}`;
      kind: "massage";
      massageId: MassageId;
      type: "massage" | "vip";
    }
  | {
      id: `voucher-amount-${string}`;
      kind: "amount";
      amountPLN: number;
      type: "amount";
    };

export type VoucherProductSelection =
  | {
      kind: "massage";
      massageId: MassageId;
      variantIndex: number;
    }
  | {
      kind: "amount";
      amountPLN: number;
    };

export type VoucherDeliveryType = "electronic" | "paper";

export const voucherCheckoutConfig = {
  paperShippingPricePLN: 15,
} as const;

export const vouchers: VoucherConfig[] = voucherMassages.map(
  (massage): VoucherConfig => ({
    id: `voucher-${massage.id}`,
    kind: "massage",
    massageId: massage.id,
    type: massage.zoneId === "vip" ? "vip" : "massage",
  }),
);
