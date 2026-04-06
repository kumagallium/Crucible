import { Suspense } from "react";
import { RegisterTab } from "@/components/register-tab";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterTab />
    </Suspense>
  );
}
