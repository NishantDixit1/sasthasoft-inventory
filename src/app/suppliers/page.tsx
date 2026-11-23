import { Suspense } from "react";

import { SuppliersClient } from "./SuppliersClient";

export const metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return (
    <Suspense>
      <SuppliersClient />
    </Suspense>
  );
}
