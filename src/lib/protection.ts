/**
 * Crop protection (pesticide) guidance layer.
 *
 * Everything here is expressed as ACTIVE INGREDIENT rates, the way FAO, EPPO,
 * CABI and national extension services publish them — never as brand names.
 * Rates are given per hectare (the international convention) and converted to
 * per-acre and to whatever land unit the farmer actually uses.
 *
 * Sources this table follows: FAO/WHO JMPR + Codex MRL practice for pre-harvest
 * intervals, the FAO International Code of Conduct on Pesticide Management,
 * WHO Recommended Classification of Pesticides by Hazard (2019), IRAC MoA
 * classification v10.x for insecticides and FRAC code list 2024 for fungicides,
 * and standard IPM economic thresholds used by extension services.
 */

export type Category = "insecticide" | "fungicide" | "herbicide" | "biological";

/** WHO acute hazard class. */
export type Hazard = "Ia" | "Ib" | "II" | "III" | "U";

export type Product = {
  /** Active ingredient, not a trade name. */
  ai: string;
  category: Category;
  /** IRAC group for insecticides, FRAC code for fungicides, HRAC for herbicides. */
  moa: string;
  /** Grams of active ingredient per hectare, low-high of the label range. */
  gAiPerHa: [number, number];
  /** Pre-harvest interval, days. */
  phi: number;
  /** Re-entry interval, hours. */
  rei: number;
  hazard: Hazard;
  /** Toxic to bees — must not be sprayed on flowering crop during bee flight. */
  beeRisk: "high" | "moderate" | "low";
  note?: string;
};

export type Threat = {
  name: string;
  kind: "insect" | "disease" | "weed";
  /** Stage names (must match the crop's stage table) when this threat bites. */
  stages: string[];
  /** What to look for, in the field, before spraying anything. */
  scouting: string;
  /** The economic / action threshold. Spray below this and you lose money. */
  threshold: string;
  /** Weather or agronomy that makes this threat likely. */
  trigger?: string;
  /** Non-chemical control that should be tried first. */
  cultural: string;
  products: Product[];
};

export type CropProtection = {
  /** Litres of finished spray per hectare for a normal knapsack/boom application. */
  waterLPerHa: [number, number];
  threats: Threat[];
  /** Crop-specific stewardship notes. */
  notes: string[];
};

// ---------------------------------------------------------------- catalogue

const P = (
  ai: string,
  category: Category,
  moa: string,
  gAiPerHa: [number, number],
  phi: number,
  rei: number,
  hazard: Hazard,
  beeRisk: Product["beeRisk"],
  note?: string,
): Product => ({ ai, category, moa, gAiPerHa, phi, rei, hazard, beeRisk, ...(note ? { note } : {}) });

// Frequently reused entries, kept identical across crops so rotation advice stays coherent.
const BT = P("Bacillus thuringiensis kurstaki", "biological", "IRAC 11A", [500, 1000], 0, 4, "U", "low", "Only kills small caterpillars — spray while larvae are under 1 cm.");
const SPINETORAM = P("Spinetoram", "insecticide", "IRAC 5", [25, 50], 7, 12, "III", "high", "Highly toxic to bees while wet; safe once dry.");
const CHLORANTRANILIPROLE = P("Chlorantraniliprole", "insecticide", "IRAC 28", [30, 50], 14, 4, "U", "low");
const EMAMECTIN = P("Emamectin benzoate", "insecticide", "IRAC 6", [8, 11], 7, 12, "II", "moderate");
const LAMBDA = P("Lambda-cyhalothrin", "insecticide", "IRAC 3A", [10, 15], 14, 24, "II", "high", "Broad-spectrum: also kills the natural enemies keeping aphids and mites down.");
const FLONICAMID = P("Flonicamid", "insecticide", "IRAC 29", [50, 70], 14, 12, "III", "low");
const PYMETROZINE = P("Pymetrozine", "insecticide", "IRAC 9B", [150, 200], 21, 12, "III", "low");
const IMIDACLOPRID = P("Imidacloprid", "insecticide", "IRAC 4A", [20, 50], 21, 12, "II", "high", "Neonicotinoid — banned or restricted outdoors in the EU and several other regions. Check local law.");
const ABAMECTIN = P("Abamectin", "insecticide", "IRAC 6", [9, 18], 7, 12, "II", "moderate");
const SPIROMESIFEN = P("Spiromesifen", "insecticide", "IRAC 23", [96, 144], 7, 12, "U", "low");
const AZOXY = P("Azoxystrobin", "fungicide", "FRAC 11", [200, 250], 14, 12, "U", "low", "Strobilurin — high resistance risk, never more than 2 sprays a season and always tank-mixed or alternated.");
const TEBUCONAZOLE = P("Tebuconazole", "fungicide", "FRAC 3", [125, 250], 21, 12, "II", "low");
const PROPICONAZOLE = P("Propiconazole", "fungicide", "FRAC 3", [125, 150], 30, 24, "II", "low");
const MANCOZEB = P("Mancozeb", "fungicide", "FRAC M03", [1500, 2000], 14, 24, "U", "low", "Multi-site protectant — the resistance-management backbone. Protective only: apply before infection.");
const CHLOROTHALONIL = P("Chlorothalonil", "fungicide", "FRAC M05", [1000, 1500], 7, 12, "U", "low", "Withdrawn in the EU; still standard elsewhere. Check local registration.");
const COPPER = P("Copper hydroxide", "fungicide", "FRAC M01", [1000, 2000], 1, 24, "II", "low", "Approved for organic production; can scorch in cool wet weather.");
const SULPHUR = P("Wettable sulphur", "fungicide", "FRAC M02", [2000, 3000], 1, 24, "U", "low", "Do not apply above 32°C or within 2 weeks of an oil spray.");
const TRICHODERMA = P("Trichoderma harzianum", "biological", "BM02", [1000, 2500], 0, 4, "U", "low", "Soil/seed applied preventively — not a rescue treatment.");
const METALAXYL_M = P("Metalaxyl-M + mancozeb", "fungicide", "FRAC 4 + M03", [1500, 2000], 14, 24, "III", "low");

// ------------------------------------------------------------ shared threats

const APHIDS = (stages: string[], extra?: Partial<Threat>): Threat => ({
  name: "Aphids",
  kind: "insect",
  stages,
  scouting: "Check 20 plants across the field, on the underside of the newest leaves and on heads. Count colonies, not individuals.",
  threshold: "Treat at 20-30 aphids per plant/tiller with fewer than one natural enemy (ladybird, syrphid larva, mummified aphid) per 50 aphids.",
  trigger: "Warm dry spells of 20-27°C after a mild winter.",
  cultural: "Leave field-edge flowering strips; aphid populations usually collapse on their own once parasitoid mummies appear.",
  products: [FLONICAMID, PYMETROZINE, LAMBDA],
  ...extra,
});

const CATERPILLAR = (name: string, stages: string[], threshold: string, scouting: string): Threat => ({
  name,
  kind: "insect",
  stages,
  scouting,
  threshold,
  cultural: "Pheromone traps to time the spray to egg hatch; destroy crop residue after harvest to break the cycle.",
  products: [BT, CHLORANTRANILIPROLE, SPINETORAM, EMAMECTIN],
});

// ------------------------------------------------------------------ by crop

export const PROTECTION: Record<string, CropProtection> = {
  corn: {
    waterLPerHa: [200, 400],
    threats: [
      CATERPILLAR(
        "Fall armyworm",
        ["Emergence", "Vegetative Growth", "Tasseling & Silking"],
        "Spray at 20% of plants with fresh whorl damage in early vegetative growth, or 10% at tasseling (FAO FAW threshold).",
        "Walk a W pattern, inspect 10 plants at 5 points. Look for windowpane feeding and moist sawdust-like frass in the whorl.",
      ),
      CATERPILLAR(
        "Corn borer / stem borer",
        ["Vegetative Growth", "Tasseling & Silking"],
        "Spray at 5% of plants with shot-hole leaf feeding plus live egg masses, before larvae bore into the stem.",
        "Check the underside of leaves near the midrib for cream-coloured egg masses; once larvae tunnel, no spray reaches them.",
      ),
      APHIDS(["Tasseling & Silking", "Grain Filling"]),
      {
        name: "Gray leaf spot & northern leaf blight",
        kind: "disease",
        stages: ["Vegetative Growth", "Tasseling & Silking", "Grain Filling"],
        scouting: "Look for rectangular grey lesions between veins (GLS) or cigar-shaped grey-green lesions (NLB) on lower leaves.",
        threshold: "Treat when lesions reach the leaf below the ear on 50% of plants before or at tasseling — that is the only window that pays.",
        trigger: "Long dews, humidity above 90% for 12+ hours, 22-30°C, continuous maize or heavy residue.",
        cultural: "Rotate out of maize for one season and pick a hybrid with a GLS/NLB rating of 5 or better.",
        products: [AZOXY, PROPICONAZOLE, MANCOZEB],
      },
    ],
    notes: [
      "Silking is when bees and beneficials work the field hardest — avoid pyrethroids while pollen is shedding.",
      "Genetically Bt-protected hybrids rarely need a caterpillar spray; check your seed tag before treating.",
    ],
  },

  wheat_spring: {
    waterLPerHa: [150, 300],
    threats: [
      APHIDS(["Stem Extension", "Heading & Flowering", "Grain Filling"], {
        threshold: "Treat at 5 aphids per tiller from flag leaf to milk stage, or 50% of tillers infested before flowering.",
      }),
      {
        name: "Rusts (stripe, leaf, stem)",
        kind: "disease",
        stages: ["Stem Extension", "Heading & Flowering", "Grain Filling"],
        scouting: "Yellow-orange pustules in stripes along the leaf (stripe rust) or scattered (leaf rust). Rub a leaf — the powder marks your thumb.",
        threshold: "Treat on first pustule detection in a susceptible variety, or at 5-10% flag-leaf severity. Protecting the flag leaf is worth more than any other spray of the season.",
        trigger: "Cool nights of 10-15°C with dew and overcast days.",
        cultural: "Resistant varieties remain the cheapest control; destroy volunteer wheat that carries rust between seasons.",
        products: [TEBUCONAZOLE, AZOXY, PROPICONAZOLE],
      },
      {
        name: "Fusarium head blight (scab)",
        kind: "disease",
        stages: ["Heading & Flowering"],
        scouting: "Bleached spikelets on an otherwise green head, sometimes with pink spore masses at the glume base.",
        threshold: "Preventive only. Spray within 2-5 days of the start of flowering if rain or humidity above 80% coincides with it — there is no rescue treatment.",
        trigger: "Rain and 20-30°C during anthesis, especially after maize.",
        cultural: "Avoid wheat directly after maize; bury residue; spread flowering dates across fields.",
        products: [
          P("Prothioconazole + tebuconazole", "fungicide", "FRAC 3", [175, 200], 30, 12, "II", "low", "Angle nozzles forward and back at 30° so both sides of the head are covered."),
          TEBUCONAZOLE,
        ],
      },
      {
        name: "Broadleaf weeds",
        kind: "weed",
        stages: ["Tillering", "Stem Extension"],
        scouting: "Count weeds per m² at the 3-5 leaf stage of the crop.",
        threshold: "Treat above roughly 20-30 broadleaf weeds per m², while the crop is still tillering — herbicide after jointing damages the head.",
        cultural: "Higher seed rate and narrow rows close the canopy and suppress most weeds.",
        products: [
          P("2,4-D amine", "herbicide", "HRAC 4", [500, 1000], 45, 48, "II", "low", "Never apply after jointing or when temperatures exceed 30°C; extreme drift risk to cotton and vegetables."),
          P("Metsulfuron-methyl", "herbicide", "HRAC 2", [4, 6], 60, 24, "U", "low", "Long soil residue — check the following crop's plant-back interval."),
        ],
      },
    ],
    notes: ["One well-timed flag-leaf fungicide usually beats two poorly timed sprays."],
  },

  rice: {
    waterLPerHa: [400, 600],
    threats: [
      {
        name: "Stem borer (yellow / striped)",
        kind: "insect",
        stages: ["Tillering", "Panicle Initiation", "Flowering"],
        scouting: "Count deadhearts during tillering and whiteheads at panicle stage on 20 hills.",
        threshold: "Treat above 5% deadhearts or 1-2% whiteheads, or when light traps catch a moth peak.",
        cultural: "Synchronised planting across the village, and clipping seedling tips at transplanting, remove most egg masses.",
        products: [CHLORANTRANILIPROLE, P("Cartap hydrochloride", "insecticide", "IRAC 14", [500, 600], 21, 24, "II", "moderate"), EMAMECTIN],
      },
      {
        name: "Brown planthopper",
        kind: "insect",
        stages: ["Tillering", "Panicle Initiation", "Flowering", "Grain Filling"],
        scouting: "Part the canopy and tap the stem base over water; count hoppers at the water line on 20 hills.",
        threshold: "Treat above 10 hoppers per hill before flowering, 20 per hill after — but only if spiders are fewer than 1 per hill.",
        trigger: "Dense canopy, excess nitrogen, and earlier pyrethroid sprays that killed the spiders.",
        cultural: "Never spray a pyrethroid in rice: it triggers planthopper resurgence. Drain the field for 3-4 days to break the population.",
        products: [PYMETROZINE, P("Buprofezin", "insecticide", "IRAC 16", [250, 375], 21, 12, "U", "low", "Kills nymphs only; useless once adults dominate."), FLONICAMID],
      },
      {
        name: "Rice blast",
        kind: "disease",
        stages: ["Tillering", "Panicle Initiation", "Flowering"],
        scouting: "Diamond-shaped lesions with grey centres on leaves; blackened neck below the panicle is the damaging phase.",
        threshold: "Treat at 5% leaf area affected, and always protectively at boot leaf when neck blast is a local problem.",
        trigger: "Night temperatures of 20-25°C with over 8 hours of leaf wetness, and high nitrogen.",
        cultural: "Split nitrogen instead of one heavy dose; keep a shallow flood rather than letting the field dry.",
        products: [
          P("Tricyclazole", "fungicide", "FRAC 16.1", [225, 300], 30, 24, "II", "low", "Not registered in some markets (residue limits on exported rice) — verify before use."),
          AZOXY,
          P("Isoprothiolane", "fungicide", "FRAC U", [300, 400], 21, 24, "II", "low"),
        ],
      },
      {
        name: "Sheath blight",
        kind: "disease",
        stages: ["Tillering", "Panicle Initiation"],
        scouting: "Oval greenish-grey lesions at the water line spreading up the sheath.",
        threshold: "Treat when 10-15% of tillers show lesions and the canopy is dense.",
        cultural: "Wider spacing and balanced potassium reduce spread more than any spray.",
        products: [AZOXY, P("Hexaconazole", "fungicide", "FRAC 3", [50, 100], 30, 24, "III", "low"), TRICHODERMA],
      },
    ],
    notes: [
      "Rice is the classic case where spraying too early destroys natural enemies and creates the pest outbreak. The first 40 days after transplanting almost never need an insecticide.",
      "Never spray into standing water that will be drained into a fish pond or open channel.",
    ],
  },

  cotton: {
    waterLPerHa: [200, 500],
    threats: [
      {
        name: "Pink bollworm",
        kind: "insect",
        stages: ["Squaring", "Flowering (Bloom)", "Boll Development"],
        scouting: "Open 20 green bolls per field weekly and look for entry holes and larvae; rosette flowers are the early sign.",
        threshold: "Treat at 5-10% infested bolls or 8 moths per pheromone trap per night for three consecutive nights.",
        cultural: "Strict end-of-season stalk destruction and a closed season are the only durable controls; mating disruption where available.",
        products: [CHLORANTRANILIPROLE, EMAMECTIN, P("Thiodicarb", "insecticide", "IRAC 1A", [500, 750], 21, 48, "Ib", "high", "WHO Class Ib — highly hazardous. Use only if nothing else is registered, with full protective equipment.")],
      },
      {
        name: "Whitefly",
        kind: "insect",
        stages: ["Vegetative Growth", "Squaring", "Flowering (Bloom)", "Boll Development"],
        scouting: "Turn over the 5th leaf from the top on 20 plants and count adults early in the morning.",
        threshold: "Treat above 5-8 adults per leaf, or 10 nymphs per 3.9 cm² leaf disc.",
        trigger: "Hot dry weather and repeated broad-spectrum sprays.",
        cultural: "Yellow sticky traps, avoid excess nitrogen, and never spray a pyrethroid in the early season — it is what creates whitefly outbreaks.",
        products: [SPIROMESIFEN, PYMETROZINE, P("Diafenthiuron", "insecticide", "IRAC 12A", [300, 400], 21, 24, "II", "moderate")],
      },
      APHIDS(["Emergence", "Squaring"]),
      {
        name: "Cotton leaf curl virus (jassid/whitefly vectored)",
        kind: "disease",
        stages: ["Vegetative Growth", "Squaring"],
        scouting: "Upward leaf curling, thickened veins and enations on the underside.",
        threshold: "No cure. Manage the whitefly vector early and rogue infected plants in the first 60 days.",
        cultural: "Plant tolerant varieties and sow early to escape the peak vector window.",
        products: [SPIROMESIFEN, PYMETROZINE],
      },
    ],
    notes: [
      "Cotton drives more insecticide resistance than any other crop — rotate IRAC groups every generation, never spray the same group twice in a row.",
      "Bt cotton still needs whitefly, jassid and mite management; it only covers bollworms.",
    ],
  },

  potato: {
    waterLPerHa: [300, 600],
    threats: [
      {
        name: "Late blight (Phytophthora infestans)",
        kind: "disease",
        stages: ["Vegetative Growth", "Tuber Initiation", "Tuber Bulking"],
        scouting: "Water-soaked dark lesions with a pale halo, white fuzz on the underside in the morning. Check low, shaded parts of the field first.",
        threshold: "Purely preventive: begin at row closure or at the first blight-favourable period and repeat every 7-10 days (5-7 in wet weather). Once you can see it, you are already late.",
        trigger: "Smith period — two consecutive days with minimum 10°C and 11+ hours of humidity above 90%.",
        cultural: "Use clean certified seed, hill soil generously over tubers, and destroy cull piles and volunteers.",
        products: [MANCOZEB, METALAXYL_M, P("Cymoxanil + famoxadone", "fungicide", "FRAC 27 + 11", [300, 450], 7, 12, "II", "low"), P("Fluazinam", "fungicide", "FRAC 29", [200, 300], 7, 24, "III", "low", "Strong tuber-blight protection — the right choice for the last two sprays.")],
      },
      {
        name: "Colorado potato beetle",
        kind: "insect",
        stages: ["Vegetative Growth", "Tuber Initiation", "Tuber Bulking"],
        scouting: "Count adults, orange egg clusters and larvae on 20 plants.",
        threshold: "Treat at 15 small larvae or 2 adults per plant, or 10% defoliation before tuber bulking.",
        cultural: "Rotate at least 400 m away from last year's potato field — the overwintering adults walk, they do not fly far.",
        products: [SPINETORAM, CHLORANTRANILIPROLE, P("Novaluron", "insecticide", "IRAC 15", [50, 75], 14, 12, "U", "low")],
      },
      {
        name: "Early blight (Alternaria)",
        kind: "disease",
        stages: ["Tuber Bulking", "Maturity & Skin Set"],
        scouting: "Concentric target-spot lesions on older leaves first.",
        threshold: "Treat when lesions appear on lower leaves during bulking, especially on nitrogen-short crops.",
        cultural: "Maintain nitrogen and potassium — stressed crops get early blight first.",
        products: [AZOXY, CHLOROTHALONIL, MANCOZEB],
      },
    ],
    notes: ["Respect the pre-harvest interval strictly: potato residues are a common cause of rejected consignments."],
  },

  tomato: {
    waterLPerHa: [400, 800],
    threats: [
      {
        name: "Tomato leafminer (Tuta absoluta)",
        kind: "insect",
        stages: ["Vegetative Growth", "Flowering & Fruit Set", "Fruit Development"],
        scouting: "Irregular blotch mines in leaves and pinhole entries in green fruit. Hang 1-2 pheromone traps per 1000 m².",
        threshold: "Treat above 3 moths per trap per night, or at the first mined leaflets on 5% of plants.",
        cultural: "Remove and bury mined leaves and infested fruit; use insect-proof netting on protected crops.",
        products: [CHLORANTRANILIPROLE, SPINETORAM, EMAMECTIN, BT],
      },
      {
        name: "Late & early blight",
        kind: "disease",
        stages: ["Vegetative Growth", "Flowering & Fruit Set", "Fruit Development"],
        scouting: "Dark greasy lesions on leaves and stems (late blight); target-spot rings on older leaves (early blight).",
        threshold: "Preventive spray programme in the wet season, every 7-10 days from first fruit set.",
        trigger: "Leaf wetness over 10 hours with 18-22°C.",
        cultural: "Stake and prune for airflow, mulch to stop soil splash, and irrigate at the base rather than overhead.",
        products: [MANCOZEB, COPPER, METALAXYL_M, AZOXY],
      },
      {
        name: "Whitefly & leaf curl virus",
        kind: "insect",
        stages: ["Establishment", "Vegetative Growth", "Flowering & Fruit Set"],
        scouting: "Shake plants and count adults flying up; check underside of young leaves for scales.",
        threshold: "For virus-prone areas the threshold is near zero in the first 6 weeks — protect the nursery and young transplants.",
        cultural: "Raise seedlings under 50-mesh net, use silver plastic mulch, and remove infected plants.",
        products: [SPIROMESIFEN, PYMETROZINE, FLONICAMID],
      },
      {
        name: "Two-spotted spider mite",
        kind: "insect",
        stages: ["Fruit Development", "Ripening & Harvest"],
        scouting: "Fine stippling and webbing on the underside of leaves; use a hand lens on 20 leaves.",
        threshold: "Treat at 5-10 mites per leaf or when webbing is visible.",
        trigger: "Hot dusty conditions and prior pyrethroid use.",
        cultural: "Release Phytoseiulus persimilis predatory mites; keep field edges dust-free.",
        products: [ABAMECTIN, SPIROMESIFEN, SULPHUR],
      },
    ],
    notes: [
      "Tomato is harvested continuously, so the pre-harvest interval is the single most important number on the label — pick before you spray, then respect the interval.",
    ],
  },

  soybean: {
    waterLPerHa: [150, 300],
    threats: [
      CATERPILLAR(
        "Defoliating caterpillars (loopers, armyworm)",
        ["Vegetative Growth", "Flowering", "Pod Development"],
        "Treat at 30% defoliation before flowering, but only 15% from flowering through pod fill.",
        "Use a defoliation card on 10 plants; count what is missing, not the larvae you can see.",
      ),
      {
        name: "Stink bugs (pod-feeding)",
        kind: "insect",
        stages: ["Pod Development", "Seed Filling"],
        scouting: "Beat-sheet or sweep-net 20 sweeps at 5 points during pod fill.",
        threshold: "Treat at 2 bugs per metre of row (grain) or 1 per metre for seed production.",
        cultural: "Harvest promptly; trap crops on field margins pull the first generation away.",
        products: [LAMBDA, P("Acetamiprid", "insecticide", "IRAC 4A", [20, 30], 14, 12, "II", "moderate")],
      },
      {
        name: "Asian soybean rust",
        kind: "disease",
        stages: ["Flowering", "Pod Development", "Seed Filling"],
        scouting: "Tan lesions with raised pustules on the underside of lower leaves — needs a hand lens.",
        threshold: "Spray at first detection in the region, preventively at R1-R3 where rust is endemic.",
        trigger: "6+ hours of leaf wetness at 18-26°C.",
        cultural: "Respect the soybean-free period; plant early-maturing varieties.",
        products: [
          P("Azoxystrobin + benzovindiflupyr", "fungicide", "FRAC 11 + 7", [200, 300], 14, 12, "III", "low"),
          TEBUCONAZOLE,
          MANCOZEB,
        ],
      },
    ],
    notes: ["Soybean compensates for early leaf loss remarkably well — most early-season insecticide sprays do not pay."],
  },

  chickpea: {
    waterLPerHa: [150, 300],
    threats: [
      CATERPILLAR(
        "Pod borer (Helicoverpa armigera)",
        ["Flowering", "Pod Filling"],
        "Treat at 1-2 larvae per metre of row, or 5% pod damage, or 5 moths per pheromone trap per night.",
        "Shake plants over a tray at 5 points and count larvae; check pods for round entry holes.",
      ),
      {
        name: "Ascochyta blight",
        kind: "disease",
        stages: ["Vegetative Growth", "Flowering", "Pod Filling"],
        scouting: "Circular lesions with concentric black pycnidia on leaves, stems and pods; patches spread along the direction of rain.",
        threshold: "Preventive spray before a forecast rain event during flowering in susceptible varieties.",
        trigger: "Cool wet weather, 15-25°C with rain splash.",
        cultural: "Use clean seed, rotate 3-4 years away from chickpea, and avoid working the field when wet.",
        products: [CHLOROTHALONIL, MANCOZEB, AZOXY],
      },
      {
        name: "Fusarium wilt",
        kind: "disease",
        stages: ["Vegetative Growth", "Flowering"],
        scouting: "Individual plants wilt and dry; split the stem — the internal tissue is discoloured.",
        threshold: "No effective foliar cure. Manage at planting.",
        cultural: "Resistant varieties and long rotation. Seed treatment with Trichoderma at sowing.",
        products: [TRICHODERMA, P("Carbendazim (seed treatment)", "fungicide", "FRAC 1", [1, 2], 0, 24, "U", "low", "Seed dressing rate is grams per kg of seed, not per hectare.")],
      },
    ],
    notes: ["Chickpea flowers over a long window — spray at dusk to protect the pollinators working it."],
  },

  sugarcane: {
    waterLPerHa: [400, 800],
    threats: [
      {
        name: "Early shoot & top borer",
        kind: "insect",
        stages: ["Germination", "Tillering", "Grand Growth"],
        scouting: "Count deadhearts per 10 m of row; a pulled deadheart smells foul and comes out easily.",
        threshold: "Treat above 10-15% deadhearts, or release Trichogramma at the first egg masses.",
        cultural: "Trash mulching, earthing up, and Trichogramma chilonis releases at 50,000 per hectare every 10 days.",
        products: [CHLORANTRANILIPROLE, P("Fipronil (granular, soil)", "insecticide", "IRAC 2B", [50, 75], 60, 24, "II", "high", "Soil-applied only; extremely toxic to bees and aquatic life if it reaches water.")],
      },
      {
        name: "Red rot",
        kind: "disease",
        stages: ["Grand Growth", "Maturation"],
        scouting: "Split the cane lengthwise: red internal tissue crossed by white patches, with a sour alcohol smell.",
        threshold: "No curative spray. Rogue and burn affected clumps immediately.",
        cultural: "Plant resistant varieties, treat setts in hot water at 50°C for 2 hours, and never take seed cane from an affected field.",
        products: [TRICHODERMA, P("Carbendazim (sett dip)", "fungicide", "FRAC 1", [1, 2], 0, 24, "U", "low", "Sett dip concentration, not a hectare rate.")],
      },
      APHIDS(["Grand Growth"], { name: "Woolly aphid", threshold: "Treat when colonies cover more than 5% of leaf area on the lower canopy." }),
    ],
    notes: ["A long-season crop: choose products with a short pre-harvest interval only near the end, and keep a written spray diary for the mill."],
  },

  sunflower: {
    waterLPerHa: [200, 400],
    threats: [
      CATERPILLAR(
        "Head-boring caterpillars",
        ["Flowering", "Seed Filling"],
        "Treat at 1-2 larvae per head on 10% of heads.",
        "Inspect 20 heads for larvae and frass between the florets.",
      ),
      {
        name: "Sclerotinia head & stem rot",
        kind: "disease",
        stages: ["Flowering", "Seed Filling"],
        scouting: "Soft brown rot on the back of the head with white mycelium and hard black sclerotia inside.",
        threshold: "Preventive at early flowering if the previous week was wet and the rotation is short.",
        trigger: "Prolonged wet weather at flowering, canopy staying wet.",
        cultural: "Rotate 4+ years away from other hosts (canola, soybean, bean) and reduce plant density.",
        products: [P("Boscalid", "fungicide", "FRAC 7", [200, 250], 21, 12, "U", "low"), AZOXY],
      },
      {
        name: "Downy mildew",
        kind: "disease",
        stages: ["Emergence", "Vegetative Growth"],
        scouting: "Stunted plants with pale mottling along the veins and white growth on the underside.",
        threshold: "Seed treatment only — foliar sprays do not work once systemic.",
        cultural: "Avoid waterlogged fields at emergence; use resistant hybrids.",
        products: [METALAXYL_M],
      },
    ],
    notes: [
      "Sunflower is a magnet for honeybees. Never spray an insecticide during bloom in daylight — apply after sunset, and tell nearby beekeepers 48 hours in advance.",
    ],
  },

  canola: {
    waterLPerHa: [150, 300],
    threats: [
      {
        name: "Flea beetle",
        kind: "insect",
        stages: ["Emergence", "Rosette"],
        scouting: "Shot-hole pitting on cotyledons; assess 10 plants at 5 points on warm afternoons.",
        threshold: "Treat at 25% leaf area lost on seedlings while the crop is still below the 4-leaf stage.",
        cultural: "Seed treatment plus higher seeding rate lets the crop grow through the damage.",
        products: [LAMBDA, P("Deltamethrin", "insecticide", "IRAC 3A", [7, 12], 21, 24, "II", "high")],
      },
      {
        name: "Sclerotinia stem rot",
        kind: "disease",
        stages: ["Flowering"],
        scouting: "Bleached lesions at stem nodes where petals have stuck; black sclerotia inside the stem.",
        threshold: "Preventive at 20-30% bloom when the canopy is dense and rain is forecast.",
        trigger: "Wet soil for 10+ days before flowering and a closed canopy.",
        cultural: "Wider rows, 4-year rotation away from broadleaf hosts.",
        products: [P("Boscalid", "fungicide", "FRAC 7", [200, 250], 21, 12, "U", "low"), AZOXY, PROPICONAZOLE],
      },
      APHIDS(["Bolting", "Pod Filling"], { name: "Cabbage aphid" }),
    ],
    notes: ["Canola flowering is peak bee activity — the Sclerotinia spray is a fungicide, so do not tank-mix an insecticide into it out of habit."],
  },

  sorghum: {
    waterLPerHa: [150, 300],
    threats: [
      CATERPILLAR(
        "Fall armyworm",
        ["Emergence", "Vegetative Growth"],
        "Treat at 20% of plants with fresh whorl damage in the first 30 days.",
        "Check the whorl of 10 plants at 5 points for windowpaning and fresh frass.",
      ),
      {
        name: "Sorghum shoot fly",
        kind: "insect",
        stages: ["Emergence"],
        scouting: "Count deadhearts in the first 30 days; white eggs sit on the underside of leaves.",
        threshold: "Treat above 10% deadhearts, or rely on seed treatment where pressure is known.",
        cultural: "Sow early and at a higher rate so the crop passes the vulnerable window fast.",
        products: [IMIDACLOPRID, LAMBDA],
      },
      {
        name: "Sugarcane aphid",
        kind: "insect",
        stages: ["Vegetative Growth", "Booting & Flowering", "Grain Filling"],
        scouting: "Sticky honeydew on the upper leaf surface; count aphids on the underside of two leaves per plant on 20 plants.",
        threshold: "Treat at 50-125 aphids per leaf during boot to soft dough.",
        cultural: "Tolerant hybrids and conserving lady beetles handle most infestations.",
        products: [FLONICAMID, P("Sulfoxaflor", "insecticide", "IRAC 4C", [25, 50], 14, 12, "II", "high"), PYMETROZINE],
      },
    ],
    notes: ["Sorghum is sensitive to some organophosphates — always spot-check a small area before treating the whole field."],
  },

  barley: {
    waterLPerHa: [150, 300],
    threats: [
      APHIDS(["Stem Extension", "Heading & Flowering"], {
        threshold: "Treat at 5 aphids per tiller from flag leaf onward, mainly to limit barley yellow dwarf virus in autumn.",
      }),
      {
        name: "Net blotch & scald",
        kind: "disease",
        stages: ["Stem Extension", "Heading & Flowering"],
        scouting: "Netted brown blotches (net blotch) or grey-green water-soaked lesions with brown margins (scald) on lower leaves.",
        threshold: "Treat when disease reaches the third leaf from the top before heading in a susceptible variety.",
        trigger: "Barley stubble retained, cool wet spring.",
        cultural: "Rotate off barley stubble; choose resistant varieties.",
        products: [PROPICONAZOLE, AZOXY, TEBUCONAZOLE],
      },
      {
        name: "Powdery mildew",
        kind: "disease",
        stages: ["Tillering", "Stem Extension"],
        scouting: "White fluffy pustules on the upper surface of lower leaves.",
        threshold: "Treat at 5% leaf area on the top three leaves.",
        cultural: "Avoid excessive early nitrogen and dense stands.",
        products: [SULPHUR, PROPICONAZOLE, AZOXY],
      },
    ],
    notes: ["Malting barley contracts often set stricter residue limits than food barley — check with your buyer before choosing a product."],
  },
};

// Winter wheat reuses the spring wheat programme with its own stage names.
PROTECTION["wheat_winter"] = {
  waterLPerHa: [150, 300],
  notes: ["Autumn aphid control matters mainly to stop barley yellow dwarf virus, not for the feeding damage itself."],
  threats: (PROTECTION["wheat_spring"] as CropProtection).threats.map((t) => ({
    ...t,
    stages: t.stages.map((s) => (s === "Tillering" ? "Autumn Tillering" : s)),
  })),
};

export function getProtection(cropKey: string): CropProtection | null {
  return PROTECTION[cropKey] ?? null;
}

// ------------------------------------------------------------- dose maths

export type AreaUnit = { key: string; label: string; m2: number };

export const AREA_UNITS: AreaUnit[] = [
  { key: "ha", label: "Hectare", m2: 10000 },
  { key: "acre", label: "Acre", m2: 4046.86 },
  { key: "kanal", label: "Kanal (Pak/Ind)", m2: 505.86 },
  { key: "marla", label: "Marla", m2: 25.29 },
  { key: "bigha", label: "Bigha (pucca)", m2: 2529.29 },
  { key: "rai", label: "Rai (Thailand)", m2: 1600 },
  { key: "mu", label: "Mu (China)", m2: 666.67 },
  { key: "donum", label: "Dunam", m2: 1000 },
  { key: "m2", label: "Square metre", m2: 1 },
];

export type Dose = {
  /** Grams of active ingredient for the whole area, low-high. */
  aiGrams: [number, number];
  /** Litres of finished spray for the whole area. */
  waterL: [number, number];
  /** Millilitres or grams of a formulated product, given its strength. */
  productAmount: [number, number];
};

/**
 * @param hectares area to treat
 * @param strength formulation strength: g of a.i. per litre (or per kg) of product
 */
export function computeDose(p: Product, waterLPerHa: [number, number], hectares: number, strength: number): Dose {
  const aiGrams: [number, number] = [p.gAiPerHa[0] * hectares, p.gAiPerHa[1] * hectares];
  const productAmount: [number, number] = [
    strength > 0 ? (aiGrams[0] / strength) * 1000 : 0,
    strength > 0 ? (aiGrams[1] / strength) * 1000 : 0,
  ];
  return {
    aiGrams,
    waterL: [waterLPerHa[0] * hectares, waterLPerHa[1] * hectares],
    productAmount,
  };
}

export function fmtAmount(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams >= 10000 ? 1 : 2)} kg`;
  if (grams >= 10) return `${grams.toFixed(0)} g`;
  return `${grams.toFixed(1)} g`;
}

export function fmtVolume(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(ml >= 10000 ? 1 : 2)} L`;
  return `${ml.toFixed(0)} mL`;
}

export function fmtWater(litres: number): string {
  if (litres >= 1000) return `${(litres / 1000).toFixed(2)} m³`;
  return `${litres.toFixed(0)} L`;
}

// --------------------------------------------------------- spray conditions

export type SprayWindow = {
  verdict: "good" | "marginal" | "hold";
  headline: string;
  reasons: string[];
  /** Days from today that look safest, or null when nothing in the window works. */
  bestDayOffset: number | null;
  bestDayLabel: string;
};

/**
 * Rain-fastness, temperature inversion and heat all decide whether a spray
 * works at all. This reads the same Open-Meteo forecast the water balance uses.
 */
export function sprayWindow(
  precip: number[],
  tmax: number[],
  tmin: number[],
  todayIdx: number,
): SprayWindow {
  const reasons: string[] = [];
  const rainToday = precip[todayIdx] ?? 0;
  const rainTomorrow = precip[todayIdx + 1] ?? 0;
  const hot = tmax[todayIdx] ?? 0;
  const cold = tmin[todayIdx] ?? 0;

  let verdict: SprayWindow["verdict"] = "good";
  if (rainToday >= 5) {
    verdict = "hold";
    reasons.push(`${rainToday.toFixed(0)}mm of rain today would wash the spray off before it is absorbed.`);
  } else if (rainToday >= 1) {
    verdict = "marginal";
    reasons.push(`Light rain today (${rainToday.toFixed(1)}mm) — most products need 2-6 rain-free hours to become rainfast.`);
  }
  if (rainTomorrow >= 10 && verdict !== "hold") {
    verdict = "marginal";
    reasons.push(`Heavy rain tomorrow (${rainTomorrow.toFixed(0)}mm) — spray early today or wait it out.`);
  }
  if (hot >= 33) {
    if (verdict === "good") verdict = "marginal";
    reasons.push(`${hot.toFixed(0)}°C today — droplets evaporate before landing. Spray before 9am or after 6pm.`);
  }
  if (cold <= 5) {
    if (verdict === "good") verdict = "marginal";
    reasons.push(`Cold night (${cold.toFixed(0)}°C) means a temperature inversion at dawn and high drift risk. Wait until mid-morning.`);
  }
  if (!reasons.length) reasons.push("No rain, no extreme heat — a normal application should work well today.");

  let best: number | null = null;
  for (let d = 0; d < 7; d++) {
    const i = todayIdx + d;
    const r = precip[i] ?? 0;
    const rNext = precip[i + 1] ?? 0;
    const t = tmax[i] ?? 0;
    if (r < 1 && rNext < 5 && t < 33) {
      best = d;
      break;
    }
  }

  return {
    verdict,
    headline:
      verdict === "good"
        ? "Good spraying conditions today"
        : verdict === "marginal"
          ? "Spray only with care today"
          : "Do not spray today",
    reasons,
    bestDayOffset: best,
    bestDayLabel:
      best === null
        ? "No clearly good window in the next 7 days — take the driest morning you can get."
        : best === 0
          ? "Today is the best window in the coming week."
          : `The next clean window is in ${best} day${best === 1 ? "" : "s"}.`,
  };
}
