import type { Metadata } from "next";
import { HistoryManager } from "@/components/dashboard/history-manager";

export const metadata: Metadata = { title: "QR history" };

export default function HistoryPage() {
  return <HistoryManager />;
}
