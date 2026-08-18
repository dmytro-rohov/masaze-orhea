export type VoucherConfig = {
  id: string;
  massageId: string;
  type: "massage" | "vip";
};

export const vouchers: VoucherConfig[] = [
  {
    id: "voucher-classic-back",
    massageId: "classic-back",
    type: "massage",
  },
  {
    id: "voucher-hot-stone",
    massageId: "hot-stone",
    type: "massage",
  },
  {
    id: "voucher-vip",
    massageId: "vip-ritual",
    type: "vip",
  },
];