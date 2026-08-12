/**
 * Regional pesticide registration & label-constraint layer.
 *
 * Purpose: a farmer anywhere on earth should only be shown active ingredients
 * that are plausibly legal where they actually farm — and should be told, in
 * plain language, when something in the international library is banned,
 * restricted or simply not registered in their jurisdiction.
 *
 * How it works
 *  1. The field's coordinates are reverse-geocoded to a country (ISO-3166-1)
 *     and, where available, a state/province/region (ISO-3166-2).
 *  2. The country maps to a REGULATORY REGIME — the authority whose approvals
 *     govern that territory (EU 1107/2009, US EPA/FIFRA, UK HSE, PMRA, APVMA,
 *     CIB&RC India, ICAMA China, ANVISA/MAPA Brazil, and so on). Every UN
 *     member state, observer state and inhabited dependent territory is mapped;
 *     anything unmapped falls back to the FAO/WHO Codex baseline.
 *  3. Sub-national overrides (US states, Canadian provinces, Indian states,
 *     Australian states, Brazilian states, EU member-state derogations) are
 *     applied on top of the regime.
 *
 * Statuses are the four a farmer cares about:
 *   approved     — registered for use, follow the label
 *   restricted   — legal but with conditions (licence, crop, season, buffer)
 *   banned       — approval withdrawn / prohibited
 *   unregistered — no known national approval, so it cannot legally be bought
 *
 * This is decision-support, not a legal register. Registrations change several
 * times a year; the panel always tells the farmer to confirm the label and the
 * national register before buying.
 */

export type RegStatus = "approved" | "restricted" | "banned" | "unregistered";

export type Ruling = { status: RegStatus; reason?: string };

export type Jurisdiction = {
  /** ISO-3166-1 alpha-2. */
  country: string;
  countryName: string;
  /** ISO-3166-2 subdivision code without the country prefix, e.g. "CA" for California. */
  subCode?: string;
  subName?: string;
  locality?: string;
  /** How we worked it out. */
  source: "coordinates" | "manual";
};

type Regime = {
  id: string;
  authority: string;
  /** Short line shown to the farmer. */
  summary: string;
  /** Default for ingredients with no explicit ruling in this regime. */
  fallback: RegStatus;
  rules: Record<string, Ruling>;
};

// ---------------------------------------------------------------- ai keys

/**
 * Normalises "Metalaxyl-M + mancozeb", "Carbendazim (seed treatment)" and
 * "Fipronil (granular, soil)" down to comparable keys. A mixture is judged by
 * its strictest component.
 */
export function aiKeys(ai: string): string[] {
  return ai
    .split("+")
    .map((part) => part.replace(/\(.*?\)/g, "").trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------- regimes

const EU_RULES: Record<string, Ruling> = {
  chlorothalonil: { status: "banned", reason: "Approval not renewed in the EU (Reg. 2019/677) — groundwater metabolites of concern." },
  mancozeb: { status: "banned", reason: "Approval not renewed in the EU (Reg. 2020/2087) — reproductive toxicity classification." },
  propiconazole: { status: "banned", reason: "Approval not renewed in the EU (Reg. 2018/1865)." },
  carbendazim: { status: "banned", reason: "Approval withdrawn in the EU — mutagenic/reprotoxic classification." },
  imidacloprid: { status: "banned", reason: "Outdoor use of neonicotinoids prohibited in the EU (Reg. 2018/783); permanent greenhouse only, and several states allow no use at all." },
  thiamethoxam: { status: "banned", reason: "Outdoor neonicotinoid ban (Reg. 2018/785)." },
  clothianidin: { status: "banned", reason: "Outdoor neonicotinoid ban (Reg. 2018/784)." },
  fipronil: { status: "banned", reason: "Approval withdrawn in the EU — unacceptable risk to bees." },
  thiodicarb: { status: "banned", reason: "No EU approval; carbamate withdrawn." },
  "cartap hydrochloride": { status: "unregistered", reason: "Never approved under Reg. 1107/2009." },
  tricyclazole: { status: "banned", reason: "EU approval withdrawn; import tolerance for rice set at the limit of determination." },
  isoprothiolane: { status: "unregistered", reason: "No EU approval." },
  hexaconazole: { status: "unregistered", reason: "No EU approval." },
  diafenthiuron: { status: "unregistered", reason: "No EU approval." },
  buprofezin: { status: "restricted", reason: "Approved in the EU only for a short list of crops, mostly protected cultivation — check the national crop list." },
  acetamiprid: { status: "restricted", reason: "Still approved in the EU but under review; several member states have cut the permitted number of applications." },
  sulfoxaflor: { status: "restricted", reason: "EU outdoor use prohibited since 2022 — permanent greenhouse only." },
  "2,4-d amine": { status: "restricted", reason: "Approved, but drift-reduction nozzles and buffer zones are mandatory in most member states." },
  "lambda-cyhalothrin": { status: "restricted", reason: "Approved with mandatory no-spray buffer strips to water; some states require a professional-user certificate." },
  deltamethrin: { status: "restricted", reason: "Approved with mandatory aquatic buffer zones." },
  abamectin: { status: "restricted", reason: "Approved mainly for protected crops; check the national crop list." },
  emamectin: { status: "restricted", reason: "Approved on a limited crop list." },
  "emamectin benzoate": { status: "restricted", reason: "Approved on a limited crop list." },
  metsulfuron: { status: "approved" },
  "metsulfuron-methyl": { status: "approved" },
};

const UK_RULES: Record<string, Ruling> = {
  ...EU_RULES,
  mancozeb: { status: "banned", reason: "GB approval expired — withdrawn by HSE/CRD in line with the EU non-renewal." },
  acetamiprid: { status: "approved", reason: "Still approved in Great Britain; follow the pollinator label statements." },
  sulfoxaflor: { status: "restricted", reason: "GB approval limited to protected crops." },
};

const US_RULES: Record<string, Ruling> = {
  chlorothalonil: { status: "approved", reason: "EPA-registered; observe the worker-protection REI and aquatic buffers on the label." },
  mancozeb: { status: "restricted", reason: "EPA-registered but under registration review — several crop uses were cancelled; verify your crop is on the label." },
  imidacloprid: { status: "restricted", reason: "Registered, with mandatory pollinator-protection language: no application to blooming crops when bees are foraging." },
  fipronil: { status: "restricted", reason: "Restricted-use pesticide — certified applicator only; no agricultural broadcast use on most field crops." },
  thiodicarb: { status: "restricted", reason: "Restricted-use pesticide — certified applicator only." },
  "lambda-cyhalothrin": { status: "restricted", reason: "Restricted-use pesticide — certified applicator only." },
  deltamethrin: { status: "restricted", reason: "Restricted-use for most agricultural formulations." },
  "2,4-d amine": { status: "restricted", reason: "State-specific cut-off dates and drift rules apply; some counties prohibit ester forms entirely." },
  carbendazim: { status: "banned", reason: "No US food-use registration." },
  tricyclazole: { status: "unregistered", reason: "Not registered for US rice — a residue violation risk for exports." },
  isoprothiolane: { status: "unregistered", reason: "No EPA registration." },
  hexaconazole: { status: "unregistered", reason: "No EPA registration." },
  "cartap hydrochloride": { status: "unregistered", reason: "No EPA registration." },
  diafenthiuron: { status: "unregistered", reason: "No EPA registration." },
};

const CA_RULES: Record<string, Ruling> = {
  ...US_RULES,
  chlorothalonil: { status: "restricted", reason: "PMRA-registered with reduced rates and mandatory buffer zones after re-evaluation." },
  imidacloprid: { status: "restricted", reason: "PMRA re-evaluation cut several outdoor uses; pollinator and aquatic-buffer conditions are mandatory." },
  mancozeb: { status: "approved", reason: "PMRA-registered; follow the re-evaluation label rates." },
};

const ANZ_RULES: Record<string, Ruling> = {
  chlorothalonil: { status: "approved" },
  mancozeb: { status: "approved" },
  imidacloprid: { status: "restricted", reason: "APVMA review in progress; do not apply to flowering crops visited by bees." },
  fipronil: { status: "restricted", reason: "Soil/seed use only; severe aquatic and bee restraints on the label." },
  carbendazim: { status: "restricted", reason: "Approved for a narrow crop list only." },
  tricyclazole: { status: "unregistered", reason: "Not registered." },
  "cartap hydrochloride": { status: "unregistered", reason: "Not registered." },
  isoprothiolane: { status: "unregistered", reason: "Not registered." },
  thiodicarb: { status: "restricted", reason: "Restricted chemical product in several states — licence required." },
};

const INDIA_RULES: Record<string, Ruling> = {
  tricyclazole: { status: "restricted", reason: "CIB&RC registered, but export consignments to the EU are rejected above 0.01 mg/kg — avoid on export basmati." },
  carbendazim: { status: "restricted", reason: "Registered, but banned outright in Kerala and under review nationally." },
  "cartap hydrochloride": { status: "approved" },
  isoprothiolane: { status: "approved" },
  hexaconazole: { status: "approved" },
  buprofezin: { status: "approved" },
  diafenthiuron: { status: "approved" },
  imidacloprid: { status: "approved", reason: "Registered; do not spray flowering crops during bee flight." },
  fipronil: { status: "restricted", reason: "Registered; granular soil use only near water bodies." },
  thiodicarb: { status: "restricted", reason: "WHO Ib — restricted-use; supervised application only." },
  chlorothalonil: { status: "approved" },
  mancozeb: { status: "approved" },
  propiconazole: { status: "approved" },
  sulfoxaflor: { status: "approved" },
};

const SOUTH_ASIA_RULES: Record<string, Ruling> = {
  ...INDIA_RULES,
  carbendazim: { status: "approved" },
  thiodicarb: { status: "restricted", reason: "WHO Class Ib — highly hazardous; several national registers are phasing it out." },
};

const EAST_ASIA_RULES: Record<string, Ruling> = {
  tricyclazole: { status: "approved", reason: "A standard rice blast material in East Asia." },
  isoprothiolane: { status: "approved" },
  "cartap hydrochloride": { status: "approved" },
  buprofezin: { status: "approved" },
  carbendazim: { status: "restricted", reason: "Registered on a limited crop list; residue limits on exported rice and tea are tight." },
  chlorothalonil: { status: "approved" },
  mancozeb: { status: "approved" },
  imidacloprid: { status: "restricted", reason: "Registered; prohibited on flowering crops during bee foraging." },
  fipronil: { status: "restricted", reason: "Prohibited on rice in China (paddy-water aquatic risk); soil use elsewhere only." },
  thiodicarb: { status: "restricted", reason: "Highly hazardous — supervised use only." },
};

const LATAM_RULES: Record<string, Ruling> = {
  chlorothalonil: { status: "approved" },
  mancozeb: { status: "approved" },
  propiconazole: { status: "approved" },
  carbendazim: { status: "restricted", reason: "Brazil cancelled carbendazim in 2022; other countries in the region still allow limited uses — confirm nationally." },
  imidacloprid: { status: "restricted", reason: "Registered; bee-protection restraints and, in Brazil, aerial-application limits apply." },
  fipronil: { status: "restricted", reason: "Registered for soil/seed treatment; aerial and flowering-crop use prohibited in Brazil." },
  tricyclazole: { status: "restricted", reason: "Registered for rice in several countries; check MRLs for the destination market." },
  "cartap hydrochloride": { status: "approved" },
  thiodicarb: { status: "restricted", reason: "Restricted-use — trained applicator only." },
  isoprothiolane: { status: "unregistered", reason: "Rarely registered in the region." },
};

const AFRICA_RULES: Record<string, Ruling> = {
  chlorothalonil: { status: "approved", reason: "Widely registered — but produce destined for the EU must meet the 0.01 mg/kg default MRL." },
  mancozeb: { status: "approved", reason: "Widely registered; EU-bound produce faces a tightened MRL." },
  propiconazole: { status: "approved" },
  carbendazim: { status: "restricted", reason: "Registered in many countries but withdrawn in others (Kenya has delisted several). Confirm with the national pest control products board." },
  imidacloprid: { status: "restricted", reason: "Registered; do not apply to flowering crops during bee flight. Under review in Kenya and South Africa." },
  fipronil: { status: "restricted", reason: "Soil/seed use only; extremely toxic to bees and fish." },
  thiodicarb: { status: "restricted", reason: "WHO Ib — highly hazardous pesticide; several registrars are phasing it out." },
  tricyclazole: { status: "restricted", reason: "Check registration; EU-bound rice must be below 0.01 mg/kg." },
  isoprothiolane: { status: "unregistered", reason: "Rarely registered in the region." },
  "cartap hydrochloride": { status: "unregistered", reason: "Rarely registered in the region." },
  hexaconazole: { status: "approved" },
};

const MENA_RULES: Record<string, Ruling> = {
  ...AFRICA_RULES,
  thiodicarb: { status: "banned", reason: "GCC/most MENA registers prohibit WHO Class Ib products for general agricultural use." },
  fipronil: { status: "restricted", reason: "Restricted to licensed applicators." },
};

const CODEX_RULES: Record<string, Ruling> = {
  thiodicarb: { status: "restricted", reason: "WHO Class Ib — highly hazardous. FAO Code of Conduct advises against use where protective equipment cannot be guaranteed." },
  imidacloprid: { status: "restricted", reason: "Neonicotinoid — banned outdoors in the EU and restricted in many countries. Verify national registration before buying." },
  fipronil: { status: "restricted", reason: "Severe bee and aquatic hazard; many countries permit soil use only." },
  chlorothalonil: { status: "restricted", reason: "Withdrawn in the EU and UK; still registered in many countries. Verify nationally and check the MRL of your buyer's market." },
  mancozeb: { status: "restricted", reason: "Withdrawn in the EU; widely registered elsewhere. Verify nationally." },
  carbendazim: { status: "restricted", reason: "Withdrawn in the EU, Brazil and elsewhere. Verify nationally." },
  tricyclazole: { status: "restricted", reason: "Tight export MRLs on rice. Verify nationally." },
};

const REGIMES: Record<string, Regime> = {
  eu: {
    id: "eu",
    authority: "European Commission / EFSA — Reg. (EC) 1107/2009",
    summary: "Only actives on the EU approved list may be sold, and each member state issues its own product authorisations and crop lists on top of that.",
    fallback: "approved",
    rules: EU_RULES,
  },
  uk: {
    id: "uk",
    authority: "HSE Chemicals Regulation Division (GB) — retained 1107/2009",
    summary: "Great Britain runs its own register since 2021; it currently mirrors most EU withdrawals.",
    fallback: "approved",
    rules: UK_RULES,
  },
  ch: {
    id: "ch",
    authority: "Swiss Federal Office for Agriculture (BLW)",
    summary: "Swiss register broadly tracks EU withdrawals, with its own water-protection conditions.",
    fallback: "approved",
    rules: EU_RULES,
  },
  us: {
    id: "us",
    authority: "US EPA under FIFRA (+ your state lead agency)",
    summary: "Federal registration plus a state registration; 'restricted-use' products need a certified applicator licence.",
    fallback: "approved",
    rules: US_RULES,
  },
  ca: {
    id: "ca",
    authority: "Health Canada PMRA (+ provincial rules)",
    summary: "Federal PMRA registration plus provincial permit and buffer-zone rules.",
    fallback: "approved",
    rules: CA_RULES,
  },
  anz: {
    id: "anz",
    authority: "APVMA (Australia) / EPA NZ",
    summary: "National approval plus state control-of-use law; some products are 'restricted chemicals' needing a licence.",
    fallback: "approved",
    rules: ANZ_RULES,
  },
  in: {
    id: "in",
    authority: "Central Insecticides Board & Registration Committee (CIB&RC), India",
    summary: "Registered under the Insecticides Act 1968; individual states can and do ban extra products.",
    fallback: "approved",
    rules: INDIA_RULES,
  },
  sasia: {
    id: "sasia",
    authority: "National plant-protection department (South Asia)",
    summary: "Registers in Pakistan, Bangladesh, Nepal and Sri Lanka broadly follow the Indian/FAO pattern.",
    fallback: "approved",
    rules: SOUTH_ASIA_RULES,
  },
  easia: {
    id: "easia",
    authority: "National registration authority (East & Southeast Asia)",
    summary: "ICAMA (China), MAFF (Japan), RDA (Korea) and ASEAN registers approve most rice-specific materials that the EU never did.",
    fallback: "approved",
    rules: EAST_ASIA_RULES,
  },
  latam: {
    id: "latam",
    authority: "National agriculture ministry / health agency (Latin America)",
    summary: "MAPA+ANVISA+IBAMA in Brazil, SENASA, SAG and equivalents elsewhere; aerial-application rules are strict.",
    fallback: "approved",
    rules: LATAM_RULES,
  },
  africa: {
    id: "africa",
    authority: "National pest control products board / plant protection service (Africa)",
    summary: "Registration is national; if you export, the buyer's MRL is usually stricter than your own register.",
    fallback: "approved",
    rules: AFRICA_RULES,
  },
  mena: {
    id: "mena",
    authority: "National ministry of agriculture (Middle East & North Africa)",
    summary: "GCC and MENA registers exclude most WHO Class Ia/Ib products and require licensed applicators for restricted ones.",
    fallback: "approved",
    rules: MENA_RULES,
  },
  eurasia: {
    id: "eurasia",
    authority: "National state register of pesticides (Eurasia / Western Balkans)",
    summary: "State registers here sit between the EU list and the FAO baseline; several EU-withdrawn actives remain legal.",
    fallback: "approved",
    rules: CODEX_RULES,
  },
  codex: {
    id: "codex",
    authority: "FAO/WHO Codex Alimentarius baseline",
    summary: "No national register is mapped for this territory yet, so international FAO/WHO guidance is shown. Confirm every product with your plant-protection service.",
    fallback: "restricted",
    rules: CODEX_RULES,
  },
};

// ------------------------------------------------------- country → regime

const EU_EEA = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GF GP MQ YT RE".split(" ");
const UK_TERR = "GB GG JE IM GI FK".split(" ");
const US_TERR = "US PR GU VI AS MP".split(" ");
const ANZ = "AU NZ CK NU TK NF".split(" ");
const SASIA = "PK BD NP LK BT MV AF".split(" ");
const EASIA = "CN JP KR KP TW HK MO MN VN TH KH LA MM MY ID PH SG BN TL PG FJ SB VU WS TO KI TV NR PW FM MH".split(" ");
const LATAM =
  "MX GT BZ SV HN NI CR PA CO VE EC PE BO BR PY UY AR CL GY SR CU DO HT JM TT BB BS AG DM GD KN LC VC AW CW SX BM KY TC VG AI MS".split(" ");
const AFRICA =
  "NG ET EG KE TZ UG GH MZ MG CI CM NE BF ML MW ZM SN TD SO ZW GN RW BJ BI TG SL LR CF MR ER NA BW GM GA LS GW GQ MU SZ DJ KM CV ST SC ZA SS SD AO CD CG".split(" ");
const MENA = "DZ MA TN LY SA AE QA KW BH OM YE JO LB SY IQ IR IL PS TR".split(" ");
const EURASIA = "RU UA BY MD GE AM AZ KZ UZ TM TJ KG RS BA MK AL ME XK".split(" ");

const COUNTRY_REGIME: Record<string, string> = {};
const assign = (codes: string[], regime: string) => codes.forEach((c) => (COUNTRY_REGIME[c] = regime));
assign(EU_EEA, "eu");
assign(UK_TERR, "uk");
assign(["CH", "AD", "MC", "SM", "VA"], "ch");
assign(US_TERR, "us");
assign(["CA", "GL", "PM", "FO"], "ca");
assign(ANZ, "anz");
assign(["IN"], "in");
assign(SASIA, "sasia");
assign(EASIA, "easia");
assign(LATAM, "latam");
assign(AFRICA, "africa");
assign(MENA, "mena");
assign(EURASIA, "eurasia");
assign(["NC", "PF", "WF"], "eu");

// -------------------------------------------------- sub-national overrides

/** Keyed "ISO2-SUBDIVISION". */
const SUB_RULES: Record<string, Record<string, Ruling>> = {
  "US-CA": {
    chlorothalonil: { status: "restricted", reason: "California restricted material — a county agricultural commissioner permit is required before purchase." },
    "lambda-cyhalothrin": { status: "restricted", reason: "California restricted material — permit and applicator licence required." },
    "2,4-d amine": { status: "restricted", reason: "California restricted material; ester formulations are prohibited in many counties during the growing season." },
    imidacloprid: { status: "restricted", reason: "DPR re-evaluation: application to blooming crops is prohibited and total seasonal load is capped." },
  },
  "US-NY": {
    imidacloprid: { status: "banned", reason: "New York's Birds and Bees Protection Act prohibits neonicotinoid-treated corn, soybean and wheat seed and restricts outdoor uses." },
    chlorothalonil: { status: "restricted", reason: "Restricted-use in New York State — certified applicator only." },
  },
  "US-WA": { "2,4-d amine": { status: "restricted", reason: "Seasonal drift-control districts restrict phenoxy herbicides near tree fruit and grapes." } },
  "US-AR": { "2,4-d amine": { status: "restricted", reason: "State cut-off dates apply to phenoxy and auxin herbicides." } },
  "US-TX": { thiodicarb: { status: "restricted", reason: "Restricted-use; boll weevil eradication zone rules may also apply." } },
  "US-FL": { imidacloprid: { status: "restricted", reason: "Additional state pollinator and surface-water restrictions apply." } },
  "CA-QC": {
    imidacloprid: { status: "restricted", reason: "Québec requires a written agronomist justification before purchase or use." },
    chlorothalonil: { status: "restricted", reason: "Québec agronomist prescription required." },
  },
  "CA-ON": { imidacloprid: { status: "restricted", reason: "Class 12 pesticide — a pest assessment report is required for treated seed." } },
  "CA-PE": { chlorothalonil: { status: "restricted", reason: "Provincial buffer-strip and slope rules apply to potato fungicide programmes." } },
  "IN-KL": {
    carbendazim: { status: "banned", reason: "Banned in Kerala by state notification." },
    imidacloprid: { status: "banned", reason: "Kerala has prohibited several neonicotinoids at state level." },
    thiodicarb: { status: "banned", reason: "Kerala prohibits WHO Class Ib products." },
  },
  "IN-PB": { "2,4-d amine": { status: "restricted", reason: "Punjab restricts phenoxy sprays near cotton and vegetable belts because of drift." } },
  "IN-SK": {
    // Sikkim is fully organic by state law.
    _all: { status: "banned", reason: "Sikkim is a 100% organic state — synthetic pesticide sale and use are prohibited by law." },
  },
  "AU-QLD": { "2,4-d amine": { status: "restricted", reason: "Queensland hazardous-inversion and 'no-spray' seasonal windows apply to phenoxy herbicides." } },
  "AU-NSW": { fipronil: { status: "restricted", reason: "Restricted chemical product in NSW — licence required." } },
  "BR-PR": { fipronil: { status: "banned", reason: "Paraná prohibits fipronil applications that put honeybee colonies at risk." } },
  "FR-": { "2,4-d amine": { status: "restricted", reason: "France applies wider mandatory no-treatment zones next to dwellings (5-20 m)." } },
};

// ---------------------------------------------------------------- lookups

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function regimeFor(j: Jurisdiction | null): Regime {
  if (!j) return REGIMES["codex"]!;
  return REGIMES[COUNTRY_REGIME[j.country.toUpperCase()] ?? "codex"] ?? REGIMES["codex"]!;
}

const RANK: Record<RegStatus, number> = { banned: 3, unregistered: 2, restricted: 1, approved: 0 };

/** The ruling for one active ingredient in one jurisdiction. */
export function rulingFor(ai: string, j: Jurisdiction | null): Ruling {
  const regime = regimeFor(j);
  const sub = j?.subCode ? SUB_RULES[`${j.country.toUpperCase()}-${j.subCode.toUpperCase()}`] : undefined;

  let worst: Ruling = { status: "approved" };
  const consider = (r: Ruling | undefined) => {
    if (r && RANK[r.status] > RANK[worst.status]) worst = r;
  };

  if (sub?.["_all"]) return sub["_all"];

  // Biologicals are treated as low-risk everywhere unless a rule says otherwise.
  const biological = /bacillus|trichoderma|sulphur|sulfur|copper/i.test(ai);

  for (const key of aiKeys(ai)) {
    consider(regime.rules[key]);
    consider(sub?.[key]);
    if (!regime.rules[key] && !sub?.[key] && !biological) {
      consider({
        status: regime.fallback,
        ...(regime.fallback === "restricted"
          ? { reason: "No national registration data mapped for this territory — confirm with your plant-protection service before buying." }
          : {}),
      });
    }
  }
  return worst;
}

export const STATUS_META: Record<RegStatus, { label: string; blurb: string; tone: string }> = {
  approved: { label: "Registered", blurb: "Registered for agricultural use here — follow the label.", tone: "ok" },
  restricted: { label: "Restricted", blurb: "Legal here, but only under conditions.", tone: "warn" },
  banned: { label: "Banned", blurb: "Prohibited where you farm — do not use.", tone: "bad" },
  unregistered: { label: "Not registered", blurb: "No known approval here, so it cannot be legally sold or applied.", tone: "bad" },
};

export function jurisdictionLabel(j: Jurisdiction): string {
  return [j.locality, j.subName, j.countryName].filter(Boolean).join(", ");
}

// ------------------------------------------------------- reverse geocoding

type BdcResponse = {
  countryCode?: string;
  countryName?: string;
  principalSubdivision?: string;
  principalSubdivisionCode?: string;
  city?: string;
  locality?: string;
};

/**
 * Resolve coordinates → country + state/province + city. Uses BigDataCloud's
 * free client endpoint (no key, worldwide land coverage, includes ISO-3166-2),
 * and falls back to Open-Meteo's reverse lookup if that is unreachable.
 */
export async function resolveJurisdiction(lat: number, lon: number): Promise<Jurisdiction | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (res.ok) {
      const d = (await res.json()) as BdcResponse;
      if (d.countryCode) {
        const subCode = d.principalSubdivisionCode?.split("-")[1];
        return {
          country: d.countryCode,
          countryName: d.countryName ?? regionName(d.countryCode),
          ...(subCode ? { subCode } : {}),
          ...(d.principalSubdivision ? { subName: d.principalSubdivision } : {}),
          ...(d.city || d.locality ? { locality: d.city || d.locality! } : {}),
          source: "coordinates",
        };
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/** Every territory the engine knows a regime for, for the manual override picker. */
export function knownCountries(): { code: string; name: string; regime: string }[] {
  return Object.keys(COUNTRY_REGIME)
    .map((code) => ({ code, name: regionName(code), regime: COUNTRY_REGIME[code]! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function manualJurisdiction(code: string, subCode?: string): Jurisdiction {
  return {
    country: code,
    countryName: regionName(code),
    ...(subCode ? { subCode, subName: subCode } : {}),
    source: "manual",
  };
}

/** Sub-national areas we hold extra rules for, so the UI can offer them. */
export function subdivisionsWithRules(country: string): string[] {
  const prefix = `${country.toUpperCase()}-`;
  return Object.keys(SUB_RULES)
    .filter((k) => k.startsWith(prefix) && k.length > prefix.length)
    .map((k) => k.slice(prefix.length))
    .sort();
}
