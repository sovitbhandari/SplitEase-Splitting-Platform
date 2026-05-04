import { CountryCode, Products } from 'plaid';

const PRODUCT_MAP: Record<string, Products> = {
  assets: Products.Assets,
  auth: Products.Auth,
  balance: Products.Balance,
  transactions: Products.Transactions,
  transfer: Products.Transfer,
};

export function parsePlaidProducts(csv: string): Products[] {
  const parts = csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: Products[] = [];
  for (const p of parts) {
    const prod = PRODUCT_MAP[p];
    if (prod) {
      out.push(prod);
    }
  }
  return out.length ? out : [Products.Auth, Products.Transactions];
}

export function parseCountryCodes(csv: string): CountryCode[] {
  const parts = csv.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const map: Record<string, CountryCode> = {
    US: CountryCode.Us,
    GB: CountryCode.Gb,
    ES: CountryCode.Es,
    NL: CountryCode.Nl,
    FR: CountryCode.Fr,
    IE: CountryCode.Ie,
    CA: CountryCode.Ca,
    DE: CountryCode.De,
  };
  const out: CountryCode[] = [];
  for (const c of parts) {
    const cc = map[c];
    if (cc) {
      out.push(cc);
    }
  }
  return out.length ? out : [CountryCode.Us];
}
