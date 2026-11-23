import { Suspense } from "react";

import { SalesClient } from "./SalesClient";

export const metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <Suspense>
      <SalesClient />
    </Suspense>
  );
}
