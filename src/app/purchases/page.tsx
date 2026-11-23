import { Suspense } from "react";

import { PurchasesClient } from "./PurchasesClient";

export const metadata = { title: "Purchase" };

export default function PurchasesPage() {
  return (
    <Suspense>
      <PurchasesClient />
    </Suspense>
  );
}
