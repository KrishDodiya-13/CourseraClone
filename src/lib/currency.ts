/**
 * Currency.
 *
 * The platform trades in Indian Rupees. Two rules hold everywhere, and both
 * predate this file — it centralises them rather than inventing them.
 *
 * **Money is an integer of minor units.** A price is paise, never rupees, and
 * never a float. `₹1,499` is stored as `149900`. Division by 100 happens once,
 * at the last possible moment, inside the formatter below. No arithmetic
 * anywhere else in the product touches a fractional amount.
 *
 * **Every stored amount carries its own ISO currency.** Orders, order items and
 * payments snapshot the currency they were agreed in, so a historical receipt
 * keeps rendering in the currency it was actually charged in even after the
 * catalogue moves. That is why the formatters accept a currency rather than
 * assuming one — the default serves the catalogue, the parameter serves the
 * archive.
 */

/** ISO 4217 code for everything priced today. */
export const DEFAULT_CURRENCY = "INR";

/**
 * Locale for money.
 *
 * `en-IN` is not cosmetic: it produces the Indian digit grouping, so six-figure
 * amounts read as `₹1,20,000` rather than `₹120,000`. Getting that wrong is the
 * kind of detail that quietly tells an Indian buyer the product was not built
 * for them.
 */
export const CURRENCY_LOCALE = "en-IN";

/** Symbols we render ourselves where `Intl` would emit a wordier form. */
const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** The bare symbol for a currency, for labels and inputs. */
export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  return SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
}

/**
 * Formats an integer minor-unit amount as money.
 *
 *   formatPrice(149900)         → "₹1,499"
 *   formatPrice(149950)         → "₹1,499.50"
 *   formatPrice(4999, "USD")    → "$49.99"
 *
 * Whole amounts drop the decimals. Course prices are almost always whole
 * rupees, and `₹1,499.00` reads like a spreadsheet export rather than a price.
 * A fractional amount still shows both digits, because hiding half a rupee on
 * a receipt is worse than an untidy column.
 */
export function formatPrice(
  minorUnits: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = CURRENCY_LOCALE,
): string {
  const whole = minorUnits % 100 === 0;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(minorUnits / 100);
}

/**
 * The same, but "Free" for zero.
 *
 * A free course shows a word, not `₹0`. The two mean the same arithmetically
 * and completely different things to someone deciding whether to enrol.
 */
export function formatCoursePrice(
  minorUnits: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = CURRENCY_LOCALE,
): string {
  return minorUnits <= 0 ? "Free" : formatPrice(minorUnits, currency, locale);
}

/**
 * Percentage saved against a strike-through price.
 *
 * Returns 0 whenever there is nothing real to claim — no compare-at price, or
 * one that is not actually higher. A "0% off" badge is worse than no badge, so
 * callers render on a truthy check.
 */
export function discountPercent(priceMinor: number, compareAtMinor: number | null): number {
  if (compareAtMinor === null || compareAtMinor <= 0 || priceMinor >= compareAtMinor) return 0;
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100);
}

/** The absolute amount saved, in minor units. */
export function savingsAmount(priceMinor: number, compareAtMinor: number | null): number {
  if (compareAtMinor === null || compareAtMinor <= priceMinor) return 0;
  return compareAtMinor - priceMinor;
}
