import type { Metadata } from "next";
import { BulkStudio } from "@/components/bulk/bulk-studio";

export const metadata: Metadata = {
  title: "Bulk QR code generator",
  description: "Create hundreds of QR codes from a CSV or Excel file — with your design, logo and a scan check for every code. Download PNG/SVG as a ZIP with a report.",
};

export default function BulkPage() {
  return <BulkStudio />;
}
