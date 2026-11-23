import { Suspense } from "react";

import { StockClient } from "./StockClient";

export const metadata = { title: "Stock" };

export default function StockPage() {
  return (
    <Suspense>
      <StockClient />
    </Suspense>
  );
}
