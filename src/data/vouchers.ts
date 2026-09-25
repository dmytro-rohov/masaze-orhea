export type VoucherConfig =
  | {
      id: `voucher-${string}`;
      kind: "massage";
      massageId: string;
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
      massageId: string;
      variantCode: string;
    }
  | {
      kind: "amount";
      amountPLN: number;
    };

export type VoucherDeliveryType = "electronic" | "paper";

export const voucherCheckoutConfig = {
  paperVoucherSurchargePLN: 50,
} as const;
