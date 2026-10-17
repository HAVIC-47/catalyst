// The account's currency: amounts are plain numbers in the database, and this only
// decides how they're written (symbol, digit grouping). Taka unless the user picks
// another in Settings; stored in the account's preferences so the web and the app
// agree. formatCurrency() and friends read the current one.

export interface CurrencyInfo {
  code: string;
  symbol: string; // as it sits before the number
  locale: string; // digit grouping (en-IN groups 1,00,000)
  name: string;
  decimals: number; // the most decimals worth showing
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "BDT", symbol: "৳", locale: "en-IN", name: "Bangladeshi taka", decimals: 2 },
  { code: "USD", symbol: "$", locale: "en-US", name: "US dollar", decimals: 2 },
  { code: "CAD", symbol: "C$", locale: "en-CA", name: "Canadian dollar", decimals: 2 },
  { code: "EUR", symbol: "€", locale: "en-IE", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", locale: "en-GB", name: "British pound", decimals: 2 },
  { code: "AUD", symbol: "A$", locale: "en-AU", name: "Australian dollar", decimals: 2 },
  { code: "INR", symbol: "₹", locale: "en-IN", name: "Indian rupee", decimals: 2 },
  { code: "PKR", symbol: "Rs ", locale: "en-IN", name: "Pakistani rupee", decimals: 2 },
  { code: "SAR", symbol: "SAR ", locale: "en-US", name: "Saudi riyal", decimals: 2 },
  { code: "AED", symbol: "AED ", locale: "en-US", name: "UAE dirham", decimals: 2 },
  { code: "MYR", symbol: "RM", locale: "en-MY", name: "Malaysian ringgit", decimals: 2 },
  { code: "SGD", symbol: "S$", locale: "en-SG", name: "Singapore dollar", decimals: 2 },
  { code: "JPY", symbol: "¥", locale: "en-US", name: "Japanese yen", decimals: 0 },
];

export const DEFAULT_CURRENCY = CURRENCIES[0];

let current: CurrencyInfo = DEFAULT_CURRENCY;

export function currencyOf(code: unknown): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? DEFAULT_CURRENCY;
}

/** Called by the app's store when the preference loads or changes. */
export function setCurrency(code: unknown): CurrencyInfo {
  current = currencyOf(code);
  return current;
}

export function currency(): CurrencyInfo {
  return current;
}
