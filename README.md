# SasthaSoft Inventory

An inventory management application covering dashboard, sales, purchase, stock,
reports, customers, suppliers and a godown view. Built as a trial task for
SasthaSoft.

**Live demo:** https://sasthasoft-inventory.vercel.app
**Source:** https://github.com/NishantDixit1/sasthasoft-inventory

---

## The idea behind it

Most inventory demos keep a `quantity` column on the item and update it from
whichever screen happens to change it. That falls out of sync the moment two
modules disagree, and it cannot answer "why is this number what it is".

This app has **no quantity field anywhere**. Every change in stock is a
`StockMovement` row with a signed quantity, a type, a reference and a godown:

```
on hand = sum of every movement for that item
```

Receiving a purchase writes positive movements. Delivering a sale writes
negative ones. Transfers write a matching pair, one out and one in. A stock
adjustment writes the difference between the counted figure and the system
figure. So the Dashboard, the Stock page, the Reports and an item's history are
all reading the same ledger, and they cannot disagree. The item history page is
just that ledger with a running balance.

## How the modules connect

| Action | What it does to stock |
| --- | --- |
| Raise a purchase order | Nothing yet. The quantity shows as **incoming** |
| Receive goods against it | **Adds** stock to the receiving godown |
| Confirm a sales order | Nothing yet. The quantity shows as **committed** |
| Deliver the sales order | **Removes** stock from the shipping godown |
| Transfer between godowns | Moves quantity, overall stock unchanged |
| Adjust stock | Posts the difference against a counted figure |

Falling below the minimum level raises a low stock alert, which surfaces on the
Dashboard and in the sidebar badge. Reordering from that alert opens a purchase
order prefilled with the item, its reorder quantity and its usual supplier, so
the loop closes without retyping anything.

Deliveries are **all or nothing**. The order is checked against what is on the
shelf before anything moves, and if any line is short the delivery is refused
with the exact shortfall per item rather than silently part shipping.

## Things worth clicking

- **⌘K / Ctrl+K** opens search across items, orders, customers and suppliers
- **Purchase → an open order → Receive goods** then look at that item's history
- **Sales → a confirmed order → Deliver** and watch the stock value drop
- A **low stock alert → Reorder** on the Dashboard
- **Stock → any item** for the full movement ledger with a running balance
- **Reports** has a CSV export on each tab
- The theme toggle, top right. Light and dark are both designed, not inverted
- **Reset data** restores the sample dataset at any point

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm run build && npm run start
```

No database, no login, no environment variables. The dataset lives in the
browser and persists to `localStorage` so your changes survive a refresh.

## How it is built

- **Next.js 16** (App Router) and **React 19**
- **Tailwind CSS v4**, configured through CSS custom properties
- **Zustand** for the store, with `persist` for the browser copy
- **TypeScript** throughout, no `any`
- **lucide-react** for icons. Charts are hand written SVG, no chart library

### Layout

```
src/
  app/                     one folder per module, each a thin page + client view
    page.tsx               Dashboard
    sales/ purchases/ stock/ reports/ customers/ suppliers/ godowns/
    stock/[id]/            item detail and its movement ledger
  components/
    ui/                    the design system: Button, Card, Badge, DataTable,
                           Modal, Drawer, Field, StatCard, Toolbar, Toaster
    layout/                AppShell, Sidebar, Topbar, CommandPalette, theme
    domain/                inventory specific cells: status badges, stock bars
    charts/                TrendChart, BarList, DonutChart (SVG)
    modals/                the workflow dialogs
  lib/
    types.ts               the domain model and the shared Result type
    seed.ts                generates the sample dataset
    store.ts               state and every mutation
    selectors.ts           all derived figures live here
    format.ts              money, dates, numbers
```

### A few deliberate decisions

**Money is integer paise.** Every amount is stored as a whole number and only
divided when it is rendered, so totals never drift through floating point.

**Mutations return one shape.** Every action on the store returns
`{ ok: true, data }` or `{ ok: false, error: { code, message } }`, the same
contract an API would use. Call sites branch once and show the message, and
errors are never ad hoc strings scattered through components.

**Derived figures have one definition.** "On hand", "available to promise",
"low stock" and "revenue" are each defined once in `selectors.ts`. Components
stay presentational.

**One table component.** `DataTable` handles sorting, paging and empty states
for all seven list screens. Filtering stays with the page, which owns the
filter controls.

**State the URL should own is in the URL.** The open record and the headline
filter are query parameters, so the dashboard can link to
`/purchases?status=open`, the command palette can jump straight to a record,
and any view can be copied out of the address bar.

### The sample data

`seed.ts` replays about four months of trading for an electrical goods
distributor: opening stock, purchase orders that get received, sales orders
that get delivered, replenishment transfers to the retail store and a few
physical count corrections. It runs the timeline in date order and never lets a
sale ship more than is on the shelf, which is why the figures across the modules
agree.

It is generated from a fixed seed with its own shuffle, so the dataset is
identical on every machine and in every browser, rather than depending on the
engine's `Array.sort` internals.

Reordering was deliberately allowed to lapse on a handful of items part way
through the window, so the demo opens with a realistic spread of low and
out-of-stock alerts instead of a uniformly healthy warehouse.

### Rendering

The dataset lives in the browser and every figure is relative to today, so there
is nothing stable to prerender. The application frame renders on the server and
the data renders once mounted, which keeps the server markup and the hydrated
markup identical.

## What is not here

Being a trial task, this is deliberately one well made slice rather than a thin
version of everything:

- No authentication, no multi-user and no server. Mutations go to a local store
  behind a `Result` contract, which is the seam a real API would slot into
- No serial or batch tracking, no multi-currency, no partial sales dispatch
  (purchases do support partial receipt)
- Master records are read only in the UI. Items, customers, suppliers and
  godowns come from the dataset
