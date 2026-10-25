import type { Metadata } from "next";
import { FinanceDashboard } from "@/features/finance/components/finance-dashboard";

export const metadata: Metadata = { title: "Finanças" };

export default function FinancasPage() {
  return <FinanceDashboard />;
}
