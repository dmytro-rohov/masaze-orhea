import type { ContactFormData } from "../contact.types";
import { getMassageById, getMassageFullName } from "@/data/massages";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createContactEmailHtml(data: ContactFormData) {
  const massage = data.massageId ? getMassageById(data.massageId) : undefined;
  const massageLabel = massage ? getMassageFullName(massage) : "Nie wybrano";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h1 style="font-size: 24px; margin: 0 0 16px;">
        Nowa wiadomość z formularza ORHEA
      </h1>

      <p><strong>Imię:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Telefon:</strong> ${escapeHtml(data.phone || "Nie podano")}</p>
      <p><strong>Preferowany kontakt:</strong> ${escapeHtml(data.preferredContactMethods.join(", "))}</p>
      <p><strong>Pora kontaktu:</strong> ${escapeHtml(data.preferredContactTime || "Nie podano")}</p>
      <p><strong>Temat:</strong> ${escapeHtml(data.subject)}</p>
      <p><strong>Masaż:</strong> ${escapeHtml(massageLabel)}</p>

      <hr style="border: 0; border-top: 1px solid #ddd; margin: 24px 0;" />

      <p><strong>Wiadomość:</strong></p>
      <p>${escapeHtml(data.message).replaceAll("\n", "<br />")}</p>
    </div>
  `;
}
