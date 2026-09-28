import type { APIContext } from "astro";

import { generateBookingAvailability } from "../../server/bookings/booking-slot-generation.service";
import {
  resolveVoucherBookingByCode,
  resolveVoucherBookingByToken,
} from "@/server/vouchers/voucher-reservation.service";
import { resolveVoucherExtraAddons } from "@/server/bookings/booking-addons.service";
import {
  BOOKING_TIME_ZONE,
  isValidBookingDate,
} from "../../server/bookings/booking-time-zone";
import { getSpecialistBookingWindow } from "../../server/bookings/booking-time-window.service";
import type { BookingSpecialistId } from "../../server/bookings/booking.types";

export const prerender = false;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const isBookingSpecialistId = (
  value: string | null,
): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

export async function GET({ request }: APIContext) {
  const searchParams = new URL(request.url).searchParams;
  const specialistId = searchParams.get("specialistId");
  const massageId = searchParams.get("massageId")?.trim();
  const variantCode = searchParams.get("variantCode")?.trim();
  const date = searchParams.get("date")?.trim();
  const addonIds = searchParams.getAll("addonId");
  const extraAddonIds = searchParams.getAll("extraAddonId");
  // Credentials travel in request headers, never in a URL that could end up in
  // browser history, referrers or ordinary request logs.
  const voucherToken = request.headers.get("x-orhea-voucher-token")?.trim();
  const voucherCode = request.headers.get("x-orhea-voucher-code")?.trim();
  const isBookingWindowRequest =
    isBookingSpecialistId(specialistId) &&
    !massageId &&
    !variantCode &&
    !date;

  if (isBookingWindowRequest) {
    try {
      const bookingWindow = await getSpecialistBookingWindow(specialistId);

      return createJsonResponse({
        success: true,
        specialistId,
        timezone: BOOKING_TIME_ZONE,
        bookingWindow,
      });
    } catch (error) {
      console.error("Booking availability window API error:", error);

      if (
        error instanceof Error &&
        error.message === "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND"
      ) {
        return createJsonResponse(
          {
            success: false,
            message: "Dostępne terminy są chwilowo niedostępne.",
          },
          503,
        );
      }

      return createJsonResponse(
        {
          success: false,
          message: "Nie udało się pobrać zakresu dostępnych terminów.",
        },
        500,
      );
    }
  }

  if (
    !isBookingSpecialistId(specialistId) ||
    ((!voucherToken && !voucherCode) && (!massageId || !variantCode)) ||
    (voucherToken && voucherCode) ||
    !date ||
    !isValidBookingDate(date)
  ) {
    return createJsonResponse(
      {
        success: false,
        message: "Podaj poprawne dane wyszukiwania dostępnych terminów.",
      },
      400,
    );
  }

  try {
    const voucher = voucherToken
      ? await resolveVoucherBookingByToken(voucherToken)
      : voucherCode
        ? await resolveVoucherBookingByCode(voucherCode)
        : null;
    const voucherExtraAddons = voucher
      ? await resolveVoucherExtraAddons({
          massageId: voucher.massageId,
          includedAddonIds: voucher.addons.map((addon) => addon.id),
          addonIds: extraAddonIds,
        })
      : null;

    const availability = await generateBookingAvailability({
      specialistId,
      massageId: voucher?.massageId ?? massageId!,
      variantCode: voucher ? "voucher" : variantCode!,
      addonIds: voucher ? [] : addonIds,
      bookingSlotMinutesOverride: voucher
        ? voucher.bookingSlotMinutes + voucher.addons.reduce(
            (sum, addon) => sum + addon.slotExtensionMinutes,
            0,
          ) + (voucherExtraAddons?.totalSlotExtensionMinutes ?? 0)
        : undefined,
      date,
    });

    return createJsonResponse({
      success: true,
      ...availability,
    });
  } catch (error) {
    console.error("Booking availability API error:", error);

    if (error instanceof Error) {
      switch (error.message) {
        case "BOOKING_SPECIALIST_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany specjalista nie jest obecnie dostępny.",
            },
            400,
          );

        case "BOOKING_VARIANT_NOT_FOUND":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany wariant masażu nie istnieje.",
            },
            400,
          );

        case "BOOKING_VARIANT_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany masaż nie jest obecnie dostępny do rezerwacji.",
            },
            400,
          );

        case "BOOKING_ADDONS_INVALID_INPUT":
        case "BOOKING_ADDONS_DUPLICATE":
        case "BOOKING_ADDONS_UNAVAILABLE":
        case "BOOKING_ADDON_MASSAGE_NOT_FOUND":
          return createJsonResponse(
            { success: false, message: "Wybrane dodatki nie są dostępne dla tego masażu." },
            400,
          );

        case "BOOKING_ADDONS_CONFLICT":
          return createJsonResponse(
            { success: false, message: "Wybranych dodatków nie można połączyć." },
            400,
          );

        case "VOUCHER_BOOKING_NOT_FOUND":
          return createJsonResponse(
            { success: false, message: "Nie można rozpoznać vouchera." },
            404,
          );
        case "VOUCHER_BOOKING_EXPIRED":
        case "VOUCHER_BOOKING_CANCELLED":
          return createJsonResponse(
            { success: false, message: "Voucher nie może już zostać wykorzystany." },
            410,
          );
        case "VOUCHER_BOOKING_UNAVAILABLE":
          return createJsonResponse(
            { success: false, message: "Voucher nie jest dostępny do rezerwacji." },
            409,
          );

        case "VOUCHER_EXTRA_ADDONS_INVALID_INPUT":
        case "VOUCHER_EXTRA_ADDONS_DUPLICATE":
        case "VOUCHER_EXTRA_ADDONS_UNAVAILABLE":
        case "VOUCHER_EXTRA_ADDONS_CONFLICT":
          return createJsonResponse(
            { success: false, message: "Wybrane dodatkowe dodatki nie są dostępne dla tej wizyty." },
            400,
          );

        case "BOOKING_SETTINGS_NOT_FOUND":
        case "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND":
        case "SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID":
        case "SPECIALIST_AVAILABILITY_CALENDAR_NOT_FOUND":
        case "BOOKING_TIME_ZONE_CONVERSION_FAILED":
        case "GOOGLE_CALENDAR_NOT_FOUND":
        case "GOOGLE_CALENDAR_QUERY_FAILED":
        case "GOOGLE_CALENDAR_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Dostępne terminy są chwilowo niedostępne.",
            },
            503,
          );
      }
    }

    return createJsonResponse(
      {
        success: false,
        message: "Nie udało się pobrać dostępnych terminów.",
      },
      500,
    );
  }
}
