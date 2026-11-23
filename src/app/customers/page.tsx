import { Suspense } from "react";

import { CustomersClient } from "./CustomersClient";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersClient />
    </Suspense>
  );
}
