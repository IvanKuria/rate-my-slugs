/**
 * Detects which UCSC page type we're on.
 * @returns {"search" | "cart-shopping" | "cart-enrolled" | null}
 */
export function detectPageType() {
  if (document.querySelectorAll(".panel.panel-default").length > 0) return "search";
  if (document.querySelectorAll('[id^="trSSR_REGFORM_VW$0_row"]').length > 0) return "cart-shopping";
  if (document.querySelectorAll('[id^="trSTDNT_ENRL_SSVW$0_row"]').length > 0) return "cart-enrolled";
  return null;
}
