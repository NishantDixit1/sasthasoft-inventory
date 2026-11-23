/**
 * Sample dataset for the demo.
 *
 * Rather than hand-writing a few dozen disconnected rows, this replays roughly
 * four months of trading for an electrical goods distributor: opening stock,
 * purchase orders that get received, sales orders that get delivered, transfers
 * between godowns and manual adjustments. Everything comes out of a fixed
 * random seed, so the dataset is identical on every render and every machine.
 *
 * The replay walks the timeline in date order and never lets a sale ship more
 * than is physically on hand. That is what makes the numbers on the Dashboard,
 * Stock and Reports pages agree with each other.
 */

import type {
  ActivityEvent,
  AppData,
  Customer,
  Godown,
  Item,
  PurchaseLine,
  PurchaseOrder,
  SalesLine,
  SalesOrder,
  StockMovement,
  Supplier,
  Transfer,
  Unit,
} from "./types";
import { addDays } from "./utils";

/* --------------------------- deterministic RNG ---------------------------- */

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates using the seeded generator. A `sort(() => random() - 0.5)`
 * shuffle would draw a number of random values that depends on the engine's
 * sort implementation, which would make the dataset differ between the server
 * and the browser.
 */
function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

/* -------------------------------- masters --------------------------------- */

const CATEGORIES = [
  { id: "cat-light", name: "Lighting" },
  { id: "cat-fan", name: "Fans & Cooling" },
  { id: "cat-wire", name: "Wires & Cables" },
  { id: "cat-switch", name: "Switchgear" },
  { id: "cat-power", name: "Power Backup" },
];

const GODOWNS: Godown[] = [
  { id: "gd-chn", code: "WH-CHN", name: "Chennai Main Warehouse", city: "Chennai", kind: "warehouse", capacity: 26000 },
  { id: "gd-cbe", code: "WH-CBE", name: "Coimbatore Depot", city: "Coimbatore", kind: "warehouse", capacity: 13000 },
  { id: "gd-blr", code: "WH-BLR", name: "Bengaluru Hub", city: "Bengaluru", kind: "warehouse", capacity: 15000 },
  { id: "gd-mdu", code: "ST-MDU", name: "Madurai Retail Store", city: "Madurai", kind: "store", capacity: 4200 },
];

interface ItemSpec {
  sku: string;
  name: string;
  brand: string;
  categoryId: string;
  unit: Unit;
  /** rupees, converted to paise below */
  cost: number;
  sell: number;
  minLevel: number;
  reorderQty: number;
  hsn: string;
  supplierId: string;
  /** rough units sold per month, drives the generated demand */
  velocity: number;
}

const ITEM_SPECS: ItemSpec[] = [
  { sku: "LGT-PNL-18R", name: "LED Panel Light 18W Round", brand: "Philips", categoryId: "cat-light", unit: "pcs", cost: 310, sell: 449, minLevel: 120, reorderQty: 400, hsn: "9405", supplierId: "sp-southgrid", velocity: 210 },
  { sku: "LGT-BTN-20", name: "LED Batten 20W Cool White", brand: "Havells", categoryId: "cat-light", unit: "pcs", cost: 265, sell: 385, minLevel: 150, reorderQty: 500, hsn: "9405", supplierId: "sp-southgrid", velocity: 260 },
  { sku: "LGT-BLB-09", name: "LED Bulb 9W B22 Base", brand: "Syska", categoryId: "cat-light", unit: "pcs", cost: 62, sell: 99, minLevel: 400, reorderQty: 1200, hsn: "9405", supplierId: "sp-velmurugan", velocity: 700 },
  { sku: "LGT-FLD-50", name: "Flood Light 50W IP65", brand: "Wipro", categoryId: "cat-light", unit: "pcs", cost: 890, sell: 1340, minLevel: 40, reorderQty: 150, hsn: "9405", supplierId: "sp-southgrid", velocity: 70 },
  { sku: "LGT-STR-90", name: "Street Light 90W Module", brand: "Bajaj", categoryId: "cat-light", unit: "pcs", cost: 2450, sell: 3390, minLevel: 20, reorderQty: 60, hsn: "9405", supplierId: "sp-anandelec", velocity: 26 },
  { sku: "FAN-CLG-DEC", name: "Ceiling Fan 1200mm Decor", brand: "Crompton", categoryId: "cat-fan", unit: "pcs", cost: 1480, sell: 2090, minLevel: 60, reorderQty: 200, hsn: "8414", supplierId: "sp-kaveri", velocity: 96 },
  { sku: "FAN-CLG-BLD", name: "Ceiling Fan BLDC 1200mm", brand: "Atomberg", categoryId: "cat-fan", unit: "pcs", cost: 2650, sell: 3490, minLevel: 40, reorderQty: 120, hsn: "8414", supplierId: "sp-kaveri", velocity: 62 },
  { sku: "FAN-WAL-400", name: "Wall Fan 400mm 3-Speed", brand: "Usha", categoryId: "cat-fan", unit: "pcs", cost: 1620, sell: 2250, minLevel: 30, reorderQty: 90, hsn: "8414", supplierId: "sp-kaveri", velocity: 38 },
  { sku: "FAN-EXH-250", name: "Exhaust Fan 250mm", brand: "Luminous", categoryId: "cat-fan", unit: "pcs", cost: 760, sell: 1150, minLevel: 50, reorderQty: 150, hsn: "8414", supplierId: "sp-velmurugan", velocity: 74 },
  { sku: "FAN-COL-50L", name: "Air Cooler 50L Desert", brand: "Symphony", categoryId: "cat-fan", unit: "pcs", cost: 7900, sell: 10990, minLevel: 12, reorderQty: 40, hsn: "8479", supplierId: "sp-kaveri", velocity: 16 },
  { sku: "WIR-FR-1.5", name: "FR Wire 1.5 sqmm 90m Coil", brand: "Polycab", categoryId: "cat-wire", unit: "box", cost: 1180, sell: 1560, minLevel: 80, reorderQty: 250, hsn: "8544", supplierId: "sp-metrocable", velocity: 130 },
  { sku: "WIR-FR-2.5", name: "FR Wire 2.5 sqmm 90m Coil", brand: "Polycab", categoryId: "cat-wire", unit: "box", cost: 1920, sell: 2490, minLevel: 60, reorderQty: 200, hsn: "8544", supplierId: "sp-metrocable", velocity: 104 },
  { sku: "WIR-FR-4.0", name: "FR Wire 4.0 sqmm 90m Coil", brand: "Finolex", categoryId: "cat-wire", unit: "box", cost: 3050, sell: 3890, minLevel: 35, reorderQty: 120, hsn: "8544", supplierId: "sp-metrocable", velocity: 48 },
  { sku: "WIR-3C-100", name: "3 Core Flexible Cable 100m", brand: "KEI", categoryId: "cat-wire", unit: "box", cost: 4250, sell: 5450, minLevel: 20, reorderQty: 60, hsn: "8544", supplierId: "sp-metrocable", velocity: 26 },
  { sku: "WIR-CAT6-305", name: "CAT6 LAN Cable 305m Box", brand: "D-Link", categoryId: "cat-wire", unit: "box", cost: 6400, sell: 8200, minLevel: 10, reorderQty: 30, hsn: "8544", supplierId: "sp-nexanetworks", velocity: 13 },
  { sku: "SWT-MOD-6A", name: "Modular Switch 6A 1-Way", brand: "Anchor Roma", categoryId: "cat-switch", unit: "pcs", cost: 48, sell: 79, minLevel: 800, reorderQty: 2500, hsn: "8536", supplierId: "sp-velmurugan", velocity: 1500 },
  { sku: "SWT-SOC-16A", name: "Modular Socket 16A", brand: "Anchor Roma", categoryId: "cat-switch", unit: "pcs", cost: 96, sell: 149, minLevel: 500, reorderQty: 1500, hsn: "8536", supplierId: "sp-velmurugan", velocity: 880 },
  { sku: "SWT-MCB-32", name: "MCB 32A Single Pole C-Curve", brand: "Schneider", categoryId: "cat-switch", unit: "pcs", cost: 210, sell: 320, minLevel: 200, reorderQty: 600, hsn: "8536", supplierId: "sp-anandelec", velocity: 330 },
  { sku: "SWT-RCB-40", name: "RCCB 40A 30mA Double Pole", brand: "Legrand", categoryId: "cat-switch", unit: "pcs", cost: 1650, sell: 2290, minLevel: 40, reorderQty: 120, hsn: "8536", supplierId: "sp-anandelec", velocity: 54 },
  { sku: "SWT-DBX-08", name: "Distribution Box 8-Way SPN", brand: "Hager", categoryId: "cat-switch", unit: "pcs", cost: 980, sell: 1420, minLevel: 30, reorderQty: 100, hsn: "8537", supplierId: "sp-anandelec", velocity: 44 },
  { sku: "SWT-PLT-08", name: "Switch Plate 8 Module", brand: "Anchor Roma", categoryId: "cat-switch", unit: "pcs", cost: 175, sell: 265, minLevel: 150, reorderQty: 450, hsn: "8538", supplierId: "sp-velmurugan", velocity: 240 },
  { sku: "PWR-INV-1100", name: "Inverter 1100VA Pure Sine", brand: "Luminous", categoryId: "cat-power", unit: "pcs", cost: 7450, sell: 9990, minLevel: 15, reorderQty: 50, hsn: "8504", supplierId: "sp-sunstream", velocity: 22 },
  { sku: "PWR-BAT-150", name: "Tubular Battery 150Ah", brand: "Exide", categoryId: "cat-power", unit: "pcs", cost: 11200, sell: 14500, minLevel: 10, reorderQty: 30, hsn: "8507", supplierId: "sp-sunstream", velocity: 19 },
  { sku: "PWR-TRL-STD", name: "Inverter Trolley Standard", brand: "Luminous", categoryId: "cat-power", unit: "pcs", cost: 980, sell: 1490, minLevel: 20, reorderQty: 60, hsn: "9403", supplierId: "sp-sunstream", velocity: 24 },
  { sku: "PWR-STB-4K", name: "Voltage Stabilizer 4KVA", brand: "V-Guard", categoryId: "cat-power", unit: "pcs", cost: 2980, sell: 3990, minLevel: 25, reorderQty: 80, hsn: "8504", supplierId: "sp-sunstream", velocity: 36 },
  { sku: "PWR-SOL-335", name: "Solar Panel 335W Polycrystalline", brand: "Waaree", categoryId: "cat-power", unit: "pcs", cost: 8900, sell: 11900, minLevel: 8, reorderQty: 30, hsn: "8541", supplierId: "sp-sunstream", velocity: 11 },
];

const ITEMS: Item[] = ITEM_SPECS.map((spec, index) => ({
  id: `it-${String(index + 1).padStart(2, "0")}`,
  sku: spec.sku,
  name: spec.name,
  brand: spec.brand,
  categoryId: spec.categoryId,
  unit: spec.unit,
  costPrice: spec.cost * 100,
  sellPrice: spec.sell * 100,
  minLevel: spec.minLevel,
  reorderQty: spec.reorderQty,
  hsn: spec.hsn,
  preferredSupplierId: spec.supplierId,
}));

const SUPPLIERS: Supplier[] = [
  { id: "sp-southgrid", code: "SUP-001", name: "SouthGrid Lighting Pvt Ltd", contactPerson: "Ravi Shankar", phone: "+91 98400 21145", email: "ravi@southgrid.co.in", city: "Chennai", gstin: "33AABCS1429L1ZP", leadTimeDays: 7, rating: 4.8 },
  { id: "sp-velmurugan", code: "SUP-002", name: "Velmurugan Electricals", contactPerson: "K. Velmurugan", phone: "+91 98430 77210", email: "vel@velmuruganelec.in", city: "Coimbatore", gstin: "33AACFV8812K1ZQ", leadTimeDays: 4, rating: 4.4 },
  { id: "sp-metrocable", code: "SUP-003", name: "Metro Cable House", contactPerson: "Imran Shaikh", phone: "+91 94440 66318", email: "imran@metrocable.in", city: "Chennai", gstin: "33AADCM3391H1ZR", leadTimeDays: 6, rating: 4.6 },
  { id: "sp-anandelec", code: "SUP-004", name: "Anand Electricals & Co", contactPerson: "Anand Rajan", phone: "+91 80500 44192", email: "anand@anandelec.in", city: "Bengaluru", gstin: "29AAECA7712J1ZD", leadTimeDays: 9, rating: 4.2 },
  { id: "sp-kaveri", code: "SUP-005", name: "Kaveri Appliances Distribution", contactPerson: "S. Lakshmi", phone: "+91 90030 55471", email: "lakshmi@kaveridist.in", city: "Trichy", gstin: "33AAGCK5590M1ZW", leadTimeDays: 10, rating: 4.7 },
  { id: "sp-sunstream", code: "SUP-006", name: "Sunstream Power Systems", contactPerson: "Mohan Pillai", phone: "+91 93450 11298", email: "mohan@sunstreampower.in", city: "Madurai", gstin: "33AAJCS2218B1ZT", leadTimeDays: 12, rating: 4.5 },
  { id: "sp-nexanetworks", code: "SUP-007", name: "Nexa Networks Supply", contactPerson: "Deepa Menon", phone: "+91 80880 32907", email: "deepa@nexanetworks.in", city: "Bengaluru", gstin: "29AAHCN6604F1ZL", leadTimeDays: 8, rating: 4.0 },
  { id: "sp-orbittools", code: "SUP-008", name: "Orbit Tools & Hardware", contactPerson: "Faisal Ahmed", phone: "+91 94870 20553", email: "faisal@orbittools.in", city: "Hosur", gstin: "33AAKCO1188N1ZB", leadTimeDays: 5, rating: 3.9 },
];

const CUSTOMERS: Customer[] = [
  { id: "cu-vaigai", code: "CUS-001", name: "Vaigai Constructions", contactPerson: "Prakash Nair", phone: "+91 98941 33027", email: "prakash@vaigaiconstructions.in", city: "Madurai", gstin: "33AABCV2291K1ZF", creditLimitInPaise: 120000000, since: "2023-04-18" },
  { id: "cu-brightway", code: "CUS-002", name: "Brightway Electricals", contactPerson: "Sridhar M", phone: "+91 98410 55832", email: "sridhar@brightway.co.in", city: "Chennai", gstin: "33AAICB4410P1ZN", creditLimitInPaise: 85000000, since: "2022-09-02" },
  { id: "cu-skyline", code: "CUS-003", name: "Skyline Builders LLP", contactPerson: "Fatima Rahman", phone: "+91 99860 72244", email: "fatima@skylinebuilders.in", city: "Bengaluru", gstin: "29AAJFS9920R1ZE", creditLimitInPaise: 250000000, since: "2021-11-25" },
  { id: "cu-kovai", code: "CUS-004", name: "Kovai Home Needs", contactPerson: "R. Sundaram", phone: "+91 98422 10937", email: "sundaram@kovaihome.in", city: "Coimbatore", gstin: "33AAFCK7731T1ZM", creditLimitInPaise: 40000000, since: "2024-02-11" },
  { id: "cu-greenspace", code: "CUS-005", name: "Greenspace Interiors", contactPerson: "Nidhi Kapoor", phone: "+91 90031 87410", email: "nidhi@greenspaceint.in", city: "Chennai", gstin: "33AAHCG2840Q1ZJ", creditLimitInPaise: 60000000, since: "2023-07-30" },
  { id: "cu-anbu", code: "CUS-006", name: "Anbu Hardware Stores", contactPerson: "T. Anbarasan", phone: "+91 94431 55608", email: "anbu@anbuhardware.in", city: "Trichy", gstin: "33AALPA4471C1ZK", creditLimitInPaise: 25000000, since: "2024-06-07" },
  { id: "cu-orchid", code: "CUS-007", name: "Orchid Facility Services", contactPerson: "Joseph Thomas", phone: "+91 80470 22115", email: "joseph@orchidfacility.in", city: "Bengaluru", gstin: "29AAGCO5529V1ZA", creditLimitInPaise: 90000000, since: "2023-01-16" },
  { id: "cu-marina", code: "CUS-008", name: "Marina Retail Chain", contactPerson: "Aisha Begum", phone: "+91 98847 60023", email: "aisha@marinaretail.in", city: "Chennai", gstin: "33AAECM1180D1ZY", creditLimitInPaise: 150000000, since: "2022-05-09" },
  { id: "cu-nilgiri", code: "CUS-009", name: "Nilgiri Resorts Group", contactPerson: "Vikram Dev", phone: "+91 90254 33871", email: "vikram@nilgiriresorts.in", city: "Ooty", gstin: "33AAFCN9032B1ZG", creditLimitInPaise: 70000000, since: "2024-10-21" },
  { id: "cu-sterling", code: "CUS-010", name: "Sterling Infra Projects", contactPerson: "Harish Kumar", phone: "+91 98400 91266", email: "harish@sterlinginfra.in", city: "Chennai", gstin: "33AAJCS4411L1ZH", creditLimitInPaise: 300000000, since: "2021-03-04" },
];

const STAFF = ["Meena R", "Karthik S", "Divya P", "Arjun N"];

/* ------------------------------ the replay -------------------------------- */

const HISTORY_DAYS = 120;

/**
 * Items whose reordering was deliberately allowed to lapse part way through the
 * window, so the demo has a realistic spread of low and out-of-stock alerts
 * instead of a uniformly healthy warehouse.
 */
const STARVED: Record<string, number> = {
  // item id -> closing stock as a multiple of its minimum level
  "it-03": 0.62,
  "it-06": 0.28,
  "it-11": 0.84,
  "it-16": 0.45,
  "it-19": 0,
  "it-22": 0.73,
  "it-26": 0,
};

interface Pending {
  date: string;
  run: () => void;
}

export function buildSeed(): AppData {
  const random = rng(20261123);
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(today, -HISTORY_DAYS);

  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];
  const between = (min: number, max: number) =>
    Math.round(min + random() * (max - min));
  const specOf = new Map(ITEMS.map((item, index) => [item.id, ITEM_SPECS[index]]));

  const movements: StockMovement[] = [];
  const activity: ActivityEvent[] = [];
  const salesOrders: SalesOrder[] = [];
  const purchaseOrders: PurchaseOrder[] = [];
  const transfers: Transfer[] = [];

  /** running on-hand per `${itemId}:${godownId}`, kept in step with `movements` */
  const ledger = new Map<string, number>();
  const key = (itemId: string, godownId: string) => `${itemId}:${godownId}`;
  const onHand = (itemId: string, godownId: string) =>
    ledger.get(key(itemId, godownId)) ?? 0;
  const onHandTotal = (itemId: string) =>
    GODOWNS.reduce((total, godown) => total + onHand(itemId, godown.id), 0);

  let movementSeq = 0;
  function move(entry: Omit<StockMovement, "id">) {
    ledger.set(
      key(entry.itemId, entry.godownId),
      onHand(entry.itemId, entry.godownId) + entry.qty,
    );
    movements.push({ ...entry, id: `mv-${++movementSeq}` });
  }

  function log(event: Omit<ActivityEvent, "id">) {
    activity.push({ ...event, id: `ac-${activity.length + 1}` });
  }

  const stamp = (day: string, hour: number, minute: number) =>
    `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  /* 1. opening stock, spread across godowns by their share of capacity */
  const totalCapacity = GODOWNS.reduce((total, g) => total + g.capacity, 0);
  ITEMS.forEach((item) => {
    const spec = specOf.get(item.id)!;
    const openingTotal = Math.round(spec.velocity * (1.2 + random() * 0.8));
    GODOWNS.forEach((godown, gIndex) => {
      const share = godown.capacity / totalCapacity;
      const qty = Math.round(openingTotal * share * (0.75 + random() * 0.5));
      if (qty <= 0) return;
      move({
        at: stamp(start, 9, 10 + gIndex),
        itemId: item.id,
        godownId: godown.id,
        qty,
        type: "opening",
        refType: "manual",
        refId: null,
        refNumber: "OPENING",
        unitCost: item.costPrice,
        note: "Opening balance carried forward",
        actor: "System",
      });
    });
  });

  /* 2. purchase orders, raised every few days against the preferred supplier */
  const pending: Pending[] = [];
  let poSeq = 1040;

  for (let day = 4; day <= HISTORY_DAYS - 1; day += between(3, 5)) {
    const orderDate = addDays(start, day);
    const supplier = pick(SUPPLIERS);
    const lapsed = day > 52;
    const supplierItems = ITEMS.filter(
      (item) =>
        item.preferredSupplierId === supplier.id &&
        !(lapsed && item.id in STARVED),
    );
    if (supplierItems.length === 0) continue;

    const godown = pick(GODOWNS.slice(0, 3));
    const chosen = shuffle(supplierItems, random).slice(
      0,
      Math.min(supplierItems.length, between(2, 4)),
    );

    const lines: PurchaseLine[] = chosen.map((item) => ({
      itemId: item.id,
      qty: Math.max(5, Math.round(item.reorderQty * (0.8 + random() * 0.4))),
      rate: Math.round(item.costPrice * (0.96 + random() * 0.07)),
      taxPct: 18,
      receivedQty: 0,
    }));

    const expectedDate = addDays(orderDate, supplier.leadTimeDays);
    const daysAgo = HISTORY_DAYS - day;
    const po: PurchaseOrder = {
      id: `po-${poSeq}`,
      number: `PO-${poSeq}`,
      supplierId: supplier.id,
      godownId: godown.id,
      date: orderDate,
      expectedDate,
      status: "ordered",
      paymentStatus: "unpaid",
      amountPaid: 0,
      lines,
      notes: random() < 0.25 ? "Deliver to gate 2, before 5pm." : undefined,
    };
    purchaseOrders.push(po);
    poSeq += 1;

    pending.push({
      date: orderDate,
      run: () =>
        log({
          at: stamp(orderDate, 11, between(0, 50)),
          kind: "purchase.created",
          title: `${po.number} raised on ${supplier.name}`,
          detail: `${lines.length} line items, expected ${expectedDate}`,
          href: `/purchases?focus=${po.id}`,
          actor: pick(STAFF),
        }),
    });

    const settled = daysAgo > Math.max(13, supplier.leadTimeDays + 2);
    if (settled) {
      const receiptDate = addDays(expectedDate, between(-1, 3));
      pending.push({
        date: receiptDate,
        run: () => {
          po.lines.forEach((line, lineIndex) => {
            line.receivedQty = line.qty;
            move({
              at: stamp(receiptDate, 10, 5 + lineIndex),
              itemId: line.itemId,
              godownId: po.godownId,
              qty: line.qty,
              type: "purchase",
              refType: "purchase",
              refId: po.id,
              refNumber: po.number,
              unitCost: line.rate,
              note: `Goods received against ${po.number}`,
              actor: "Goods Inward",
            });
          });
          po.status = "received";
          const total = purchaseTotal(po);
          po.paymentStatus = random() < 0.76 ? "paid" : "partial";
          po.amountPaid =
            po.paymentStatus === "paid" ? total : Math.round(total * 0.5);
          log({
            at: stamp(receiptDate, 10, 15),
            kind: "purchase.received",
            title: `${po.number} received into ${godown.name}`,
            detail: `${po.lines.reduce((t, l) => t + l.receivedQty, 0)} units added to stock`,
            href: `/purchases?focus=${po.id}`,
            actor: "Goods Inward",
          });
        },
      });
    } else if (daysAgo > 3 && random() < 0.5) {
      const receiptDate = addDays(orderDate, between(2, 3));
      pending.push({
        date: receiptDate,
        run: () => {
          const line = po.lines[0];
          line.receivedQty = Math.max(1, Math.round(line.qty * 0.6));
          move({
            at: stamp(receiptDate, 12, 20),
            itemId: line.itemId,
            godownId: po.godownId,
            qty: line.receivedQty,
            type: "purchase",
            refType: "purchase",
            refId: po.id,
            refNumber: po.number,
            unitCost: line.rate,
            note: `Part receipt against ${po.number}`,
            actor: "Goods Inward",
          });
          po.status = "partial";
          log({
            at: stamp(receiptDate, 12, 25),
            kind: "purchase.received",
            title: `${po.number} part received`,
            detail: `${line.receivedQty} of ${line.qty} units on the first line`,
            href: `/purchases?focus=${po.id}`,
            actor: "Goods Inward",
          });
        },
      });
    }
  }

  /* one cancelled purchase order, so the status filter has something to find */
  const cancelledPo: PurchaseOrder = {
    id: "po-1039",
    number: "PO-1039",
    supplierId: "sp-orbittools",
    godownId: "gd-chn",
    date: addDays(today, -26),
    expectedDate: addDays(today, -21),
    status: "cancelled",
    paymentStatus: "unpaid",
    amountPaid: 0,
    lines: [
      { itemId: "it-20", qty: 60, rate: 96500, taxPct: 18, receivedQty: 0 },
      { itemId: "it-18", qty: 200, rate: 20800, taxPct: 18, receivedQty: 0 },
    ],
    notes: "Cancelled, supplier could not hold the quoted rate.",
  };
  purchaseOrders.push(cancelledPo);

  /* 3. sales orders, most days of the window */
  let soSeq = 2180;
  for (let day = 2; day <= HISTORY_DAYS; day += between(1, 2)) {
    const orderDate = addDays(start, day);
    const customer = pick(CUSTOMERS);
    const godown = pick(GODOWNS);
    const channel = (["distributor", "retail", "online"] as const)[
      random() < 0.5 ? 0 : random() < 0.55 ? 1 : 2
    ];
    const chosen = shuffle(ITEMS, random).slice(0, between(2, 4));

    // the retail counter moves small quantities, warehouses ship project lots
    const lotFactor = godown.kind === "store" ? 0.06 : 0.15;
    const lines: SalesLine[] = chosen.map((item) => {
      const spec = specOf.get(item.id)!;
      return {
        itemId: item.id,
        qty: Math.max(1, Math.round(spec.velocity * (lotFactor + random() * 0.45 * (lotFactor / 0.15)))),
        rate: Math.round(item.sellPrice * (0.97 + random() * 0.05)),
        discountPct: random() < 0.3 ? [2, 3, 5][Math.floor(random() * 3)] : 0,
        taxPct: 18,
      };
    });

    const daysAgo = HISTORY_DAYS - day;
    const so: SalesOrder = {
      id: `so-${soSeq}`,
      number: `SO-${soSeq}`,
      customerId: customer.id,
      godownId: godown.id,
      date: orderDate,
      dueDate: addDays(orderDate, 21),
      channel,
      status: "confirmed",
      paymentStatus: "unpaid",
      amountPaid: 0,
      lines,
      notes: random() < 0.2 ? "Site delivery, call before dispatch." : undefined,
    };
    salesOrders.push(so);
    soSeq += 1;

    pending.push({
      date: orderDate,
      run: () =>
        log({
          at: stamp(orderDate, 10, between(0, 55)),
          kind: "sale.created",
          title: `${so.number} confirmed for ${customer.name}`,
          detail: `${lines.length} line items`,
          href: `/sales?focus=${so.id}`,
          actor: pick(STAFF),
        }),
    });

    // Older orders have shipped; the last few days stay open on purpose so the
    // reviewer has something to actually deliver from the Sales module.
    if (daysAgo > 6) {
      const deliveryDate = addDays(orderDate, between(0, 2));
      pending.push({
        date: deliveryDate,
        run: () => deliver(so, deliveryDate, customer.name, godown.name),
      });
    } else if (daysAgo > 1 && random() < 0.35) {
      so.status = "draft";
    }
  }

  function deliver(so: SalesOrder, day: string, customerName: string, godownName: string) {
    // Work out what can actually ship before touching anything. Never ship more
    // than is physically on the shelf, and if nothing can ship leave the order
    // untouched so it stays open with its original quantities intact.
    const shipping = so.lines
      .map((line) => ({
        line,
        qty: Math.min(line.qty, Math.max(0, onHand(line.itemId, so.godownId))),
      }))
      .filter((entry) => entry.qty > 0);

    if (shipping.length === 0) return;

    shipping.forEach(({ line, qty }, lineIndex) => {
      move({
        at: stamp(day, 15, 10 + lineIndex),
        itemId: line.itemId,
        godownId: so.godownId,
        qty: -qty,
        type: "sale",
        refType: "sale",
        refId: so.id,
        refNumber: so.number,
        unitCost: ITEMS.find((item) => item.id === line.itemId)!.costPrice,
        note: `Delivered against ${so.number}`,
        actor: "Dispatch",
      });
    });

    so.lines = shipping.map(({ line, qty }) => ({ ...line, qty }));
    so.status = "delivered";
    so.deliveredAt = day;
    const total = salesTotal(so);
    const roll = random();
    so.paymentStatus = roll < 0.66 ? "paid" : roll < 0.85 ? "partial" : "unpaid";
    so.amountPaid =
      so.paymentStatus === "paid"
        ? total
        : so.paymentStatus === "partial"
          ? Math.round(total * (0.3 + random() * 0.3))
          : 0;
    log({
      at: stamp(day, 15, 30),
      kind: "sale.delivered",
      title: `${so.number} delivered to ${customerName}`,
      detail: `Stock released from ${godownName}`,
      href: `/sales?focus=${so.id}`,
      actor: "Dispatch",
    });
  }

  /* 4. stock transfers: the retail store is replenished from the main
     warehouse rather than being bought into directly */
  let transferSeq = 31;
  for (let day = 20; day <= HISTORY_DAYS - 4; day += 18) {
    const transferDate = addDays(start, day);
    const number = `TR-${String(transferSeq).padStart(4, "0")}`;
    const toStore = transferSeq % 2 === 1;
    const from = "gd-chn";
    const to = toStore ? "gd-mdu" : "gd-blr";
    transferSeq += 1;

    const chosen = shuffle(ITEMS, random).slice(0, toStore ? 6 : 3);
    const transfer: Transfer = {
      id: number.toLowerCase(),
      number,
      fromGodownId: from,
      toGodownId: to,
      date: transferDate,
      status: "completed",
      lines: [],
      notes: toStore ? "Counter replenishment for the retail store" : "Rebalancing fast movers",
    };
    transfers.push(transfer);

    pending.push({
      date: transferDate,
      run: () => {
        chosen.forEach((item, index) => {
          const spec = specOf.get(item.id)!;
          const want = toStore
            ? Math.max(2, Math.round(spec.velocity * 0.35))
            : Math.round(onHand(item.id, from) * 0.2);
          const qty = Math.min(want, Math.floor(onHand(item.id, from) * 0.5));
          if (qty <= 0) return;
          transfer.lines.push({ itemId: item.id, qty });
          move({
            at: stamp(transferDate, 9, 30 + index),
            itemId: item.id,
            godownId: from,
            qty: -qty,
            type: "transfer-out",
            refType: "transfer",
            refId: transfer.id,
            refNumber: number,
            unitCost: item.costPrice,
            note: `Transferred out on ${number}`,
            actor: "Warehouse",
          });
          move({
            at: stamp(transferDate, 14, 30 + index),
            itemId: item.id,
            godownId: to,
            qty,
            type: "transfer-in",
            refType: "transfer",
            refId: transfer.id,
            refNumber: number,
            unitCost: item.costPrice,
            note: `Transferred in on ${number}`,
            actor: "Warehouse",
          });
        });
        if (transfer.lines.length === 0) return;
        log({
          at: stamp(transferDate, 14, 45),
          kind: "transfer.completed",
          title: `${number} completed`,
          detail: `${transfer.lines.length} items moved to ${
            GODOWNS.find((g) => g.id === to)!.name
          }`,
          href: "/godowns",
          actor: "Warehouse",
        });
      },
    });
  }

  /* 5. physical count corrections */
  [
    { itemId: "it-04", godownId: "gd-chn", qty: -11, dayOffset: 70, note: "Physical count variance, damaged in handling" },
    { itemId: "it-17", godownId: "gd-cbe", qty: -38, dayOffset: 101, note: "Cycle count correction" },
    { itemId: "it-12", godownId: "gd-blr", qty: 12, dayOffset: 110, note: "Found in reserve rack during audit" },
  ].forEach(({ itemId, godownId, qty, dayOffset, note }) => {
    const day = addDays(start, dayOffset);
    pending.push({
      date: day,
      run: () => {
        const item = ITEMS.find((i) => i.id === itemId)!;
        if (qty < 0 && onHand(itemId, godownId) < Math.abs(qty)) return;
        move({
          at: stamp(day, 17, 5),
          itemId,
          godownId,
          qty,
          type: "adjustment",
          refType: "manual",
          refId: null,
          refNumber: "ADJ",
          unitCost: item.costPrice,
          note,
          actor: pick(STAFF),
        });
        log({
          at: stamp(day, 17, 6),
          kind: "stock.adjusted",
          title: `${item.name} adjusted by ${qty > 0 ? "+" : ""}${qty}`,
          detail: note,
          href: `/stock/${itemId}`,
          actor: "Stock Audit",
        });
      },
    });
  });

  /* run the whole timeline in date order, so stock can never go negative */
  pending
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .forEach((event) => event.run());

  /* 6. closing project dispatches that bring the lapsed items down to their
     target levels. The shortfall is spread across the warehouses in proportion
     to what each is holding, so no single godown is emptied. */
  const drainPlan = new Map<string, Map<string, number>>();
  const warehouses = GODOWNS.filter((godown) => godown.kind === "warehouse");

  for (const [itemId, factor] of Object.entries(STARVED)) {
    const item = ITEMS.find((i) => i.id === itemId)!;
    const target = Math.round(item.minLevel * factor);
    const held = warehouses.map((godown) => onHand(itemId, godown.id));
    const heldTotal = held.reduce((total, qty) => total + qty, 0);
    let shortfall = onHandTotal(itemId) - target;
    if (shortfall <= 0 || heldTotal <= 0) continue;
    shortfall = Math.min(shortfall, heldTotal);

    const plan = new Map<string, number>();
    warehouses.forEach((godown, index) => {
      const share = Math.min(
        held[index],
        Math.round(shortfall * (held[index] / heldTotal)),
      );
      if (share > 0) plan.set(godown.id, share);
    });
    // hand any rounding remainder to the godown holding the most
    const planned = [...plan.values()].reduce((total, qty) => total + qty, 0);
    const remainder = shortfall - planned;
    if (remainder > 0) {
      const biggest = warehouses[held.indexOf(Math.max(...held))];
      const current = plan.get(biggest.id) ?? 0;
      plan.set(biggest.id, Math.min(held[warehouses.indexOf(biggest)], current + remainder));
    }
    drainPlan.set(itemId, plan);
  }

  // Spread each godown's shortfall over three dispatches several days apart so
  // the run-down reads as ordinary trading rather than one freak order.
  const DISPATCH_PARTS = 3;
  const dispatches = warehouses.flatMap((godown, index) =>
    Array.from({ length: DISPATCH_PARTS }, (_, part) => ({
      godown,
      index,
      part,
      day: addDays(today, -(46 - index * 2 - part * 8)),
    })),
  );

  dispatches.forEach(({ godown, index, part, day }) => {
    const lines: SalesLine[] = [];

    for (const [itemId, plan] of drainPlan) {
      const total = plan.get(godown.id) ?? 0;
      if (total <= 0) continue;
      // split as evenly as possible, with the remainder on the earlier parts
      const base = Math.floor(total / DISPATCH_PARTS);
      const qty = base + (part < total % DISPATCH_PARTS ? 1 : 0);
      if (qty <= 0) continue;
      const item = ITEMS.find((i) => i.id === itemId)!;
      lines.push({
        itemId,
        qty,
        rate: Math.round(item.sellPrice * 0.97),
        discountPct: 3,
        taxPct: 18,
      });
    }
    if (lines.length === 0) return;

    const customer = CUSTOMERS[(index + 2) % CUSTOMERS.length];
    const so: SalesOrder = {
      id: `so-${soSeq}`,
      number: `SO-${soSeq}`,
      customerId: customer.id,
      godownId: godown.id,
      date: day,
      dueDate: addDays(day, 21),
      channel: "distributor",
      status: "confirmed",
      paymentStatus: "unpaid",
      amountPaid: 0,
      lines,
      notes: "Project dispatch, full quantity released in one lot.",
    };
    salesOrders.push(so);
    soSeq += 1;
    log({
      at: stamp(day, 9, 20),
      kind: "sale.created",
      title: `${so.number} confirmed for ${customer.name}`,
      detail: `Project dispatch, ${lines.length} line items`,
      href: `/sales?focus=${so.id}`,
      actor: STAFF[(index + part) % STAFF.length],
    });
    deliver(so, day, customer.name, godown.name);
  });

  /* 7. one cancelled sales order */
  salesOrders.push({
    id: "so-2179",
    number: "SO-2179",
    customerId: "cu-anbu",
    godownId: "gd-mdu",
    date: addDays(today, -17),
    dueDate: addDays(today, 4),
    channel: "retail",
    status: "cancelled",
    paymentStatus: "unpaid",
    amountPaid: 0,
    lines: [{ itemId: "it-09", qty: 24, rate: 115000, discountPct: 0, taxPct: 18 }],
    notes: "Customer cancelled, site handover pushed to next quarter.",
  });

  movements.sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1));
  activity.sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));

  return {
    categories: CATEGORIES,
    godowns: GODOWNS,
    items: ITEMS,
    customers: CUSTOMERS,
    suppliers: SUPPLIERS,
    salesOrders: salesOrders.sort(byDateThenNumber),
    purchaseOrders: purchaseOrders.sort(byDateThenNumber),
    transfers,
    movements,
    activity: activity.slice(0, 80),
  };
}

/** Newest first, with the order number breaking ties so the sort is total. */
function byDateThenNumber(
  a: { date: string; number: string },
  b: { date: string; number: string },
): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.number < b.number ? 1 : -1;
}

/* ------------------------------ line maths -------------------------------- */

export function salesLineNet(line: SalesLine): number {
  const gross = line.qty * line.rate;
  return Math.round(gross * (1 - line.discountPct / 100));
}

export function salesLineTax(line: SalesLine): number {
  return Math.round(salesLineNet(line) * (line.taxPct / 100));
}

export function salesTotal(order: Pick<SalesOrder, "lines">): number {
  return order.lines.reduce(
    (total, line) => total + salesLineNet(line) + salesLineTax(line),
    0,
  );
}

export function purchaseLineNet(line: PurchaseLine): number {
  return line.qty * line.rate;
}

export function purchaseTotal(order: Pick<PurchaseOrder, "lines">): number {
  return order.lines.reduce(
    (total, line) =>
      total + purchaseLineNet(line) + Math.round(purchaseLineNet(line) * (line.taxPct / 100)),
    0,
  );
}
