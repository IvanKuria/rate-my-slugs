/**
 * Detects which UCSC page type we're on.
 * @returns {"search" | "cart-shopping" | "cart-enrolled" | "class-detail" | "enrollment-confirm" | "waitlist" | "generic-instructor" | null}
 */
export function detectPageType() {
  // Search results page
  if (document.querySelectorAll(".panel.panel-default").length > 0) return "search";

  // Shopping cart
  if (document.querySelectorAll('[id^="trSSR_REGFORM_VW$0_row"]').length > 0) return "cart-shopping";

  // Enrolled classes
  if (document.querySelectorAll('[id^="trSTDNT_ENRL_SSVW$0_row"]').length > 0) return "cart-enrolled";

  // Class detail / description pages
  if (document.querySelector('[id*="SSR_CLSRCH_F_WK"]') || document.querySelector('.PSGROUPBOXWBO')) return "class-detail";

  // Enrollment confirmation
  if (document.querySelector('[id*="DERIVED_REGFRM1_SSR_PB_ADDTOLIST2"]') || document.querySelector('[id*="SSR_SS_ERD_ER"]')) return "enrollment-confirm";

  // Waitlist view
  if (document.querySelector('[id*="SSR_REGFORM_VW$0"]') && document.body?.textContent?.includes('Wait List')) return "waitlist";

  // Generic instructor pattern - catch any page with instructor name elements
  if (document.querySelector('[id*="INSTR_LONG"]') || document.querySelector('[id*="MTG_INSTR"]')) return "generic-instructor";

  return null;
}
