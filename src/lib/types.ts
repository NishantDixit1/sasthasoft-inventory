/**
 * Domain model for the inventory system.
 *
 * Single source of truth for stock: every quantity change is a StockMovement.
 * An item's on-hand quantity is the sum of its movements, never a stored field.
 * That keeps purchases, sales, transfers and adjustments impossible to desync
 * and gives a full audit history for free.
 */

export type ID = string;
export type ISODate = string;

export type Unit = "pcs" | "box" | "set" | "kg" | "ltr" | "mtr";

export interface Category {
  id: ID;
  name: string;
}

export interface Godown {
  id: ID;
  code: string;
  name: string;
  city: string;
  kind: "warehouse" | "store";
  capacity: number;
}

export interface Item {
  id: ID;
  sku: string;
  name: string;
  categoryId: ID;
  brand: string;
  unit: Unit;
  costPrice: number;
  sellPrice: number;
  minLevel: number;
  reorderQty: number;
  hsn: string;
  preferredSupplierId: ID;
}

export interface Customer {
  id: ID;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  gstin: string;
  creditLimitInPaise: number;
  since: ISODate;
}

export interface Supplier {
  id: ID;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  gstin: string;
  leadTimeDays: number;
  rating: number;
}

/* ------------------------------- orders ---------------------------------- */

export type SalesStatus = "draft" | "confirmed" | "delivered" | "cancelled";
export type PurchaseStatus =
  | "draft"
  | "ordered"
  | "partial"
  | "received"
  | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type SalesChannel = "retail" | "online" | "distributor";

export interface SalesLine {
  itemId: ID;
  qty: number;
  /** rate in paise, per unit, before tax */
  rate: number;
  discountPct: number;
  taxPct: number;
}

export interface SalesOrder {
  id: ID;
  number: string;
  customerId: ID;
  godownId: ID;
  date: ISODate;
  dueDate: ISODate;
  channel: SalesChannel;
  status: SalesStatus;
  paymentStatus: PaymentStatus;
  /** in paise */
  amountPaid: number;
  lines: SalesLine[];
  notes?: string;
  deliveredAt?: ISODate;
}

export interface PurchaseLine {
  itemId: ID;
  qty: number;
  /** rate in paise, per unit, before tax */
  rate: number;
  taxPct: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: ID;
  number: string;
  supplierId: ID;
  godownId: ID;
  date: ISODate;
  expectedDate: ISODate;
  status: PurchaseStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  lines: PurchaseLine[];
  notes?: string;
}

/* ------------------------------ movements -------------------------------- */

export type MovementType =
  | "opening"
  | "purchase"
  | "sale"
  | "adjustment"
  | "transfer-in"
  | "transfer-out";

export type RefType = "purchase" | "sale" | "transfer" | "manual";

export interface StockMovement {
  id: ID;
  at: ISODate;
  itemId: ID;
  godownId: ID;
  /** signed: positive adds to stock, negative removes */
  qty: number;
  type: MovementType;
  refType: RefType;
  refId: ID | null;
  refNumber: string;
  /** unit cost in paise at the time of the movement */
  unitCost: number;
  note?: string;
  actor: string;
}

/* ------------------------------ transfers -------------------------------- */

export type TransferStatus = "draft" | "in-transit" | "completed";

export interface TransferLine {
  itemId: ID;
  qty: number;
}

export interface Transfer {
  id: ID;
  number: string;
  fromGodownId: ID;
  toGodownId: ID;
  date: ISODate;
  status: TransferStatus;
  lines: TransferLine[];
  notes?: string;
}

/* ------------------------------- activity -------------------------------- */

export type ActivityKind =
  | "sale.created"
  | "sale.delivered"
  | "sale.payment"
  | "sale.cancelled"
  | "purchase.created"
  | "purchase.received"
  | "purchase.payment"
  | "purchase.cancelled"
  | "stock.adjusted"
  | "transfer.completed";

export interface ActivityEvent {
  id: ID;
  at: ISODate;
  kind: ActivityKind;
  title: string;
  detail: string;
  href?: string;
  actor: string;
}

/* ------------------------------ derived ----------------------------------- */

export type StockHealth = "out" | "critical" | "low" | "healthy" | "excess";

export interface ItemStock {
  item: Item;
  onHand: number;
  byGodown: Record<ID, number>;
  /** units sitting on confirmed-but-not-delivered sales orders */
  committed: number;
  /** units on ordered purchase orders not yet received */
  incoming: number;
  available: number;
  health: StockHealth;
  /** on-hand valued at cost, in paise */
  value: number;
  lastMovementAt: ISODate | null;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/* ------------------------------ app state -------------------------------- */

export interface AppData {
  categories: Category[];
  godowns: Godown[];
  items: Item[];
  customers: Customer[];
  suppliers: Supplier[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  transfers: Transfer[];
  movements: StockMovement[];
  activity: ActivityEvent[];
}

/**
 * Single result shape for every mutation in the app, so callers always branch
 * the same way and error messages are never ad hoc.
 */
export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
