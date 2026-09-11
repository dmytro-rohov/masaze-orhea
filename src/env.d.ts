/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    admin?: import("./server/admin/admin-auth.service").AdminSession;
  }
}
