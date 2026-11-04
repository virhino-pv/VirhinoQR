import type { Metadata } from "next";
import { TemplatesManager } from "@/components/dashboard/templates-manager";

export const metadata: Metadata = { title: "My templates" };

export default function DashboardTemplatesPage() {
  return <TemplatesManager />;
}
