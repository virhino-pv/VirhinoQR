import type { Metadata } from "next";
import { ProjectsManager } from "@/components/dashboard/projects-manager";

export const metadata: Metadata = { title: "My QR projects" };

export default function ProjectsPage() {
  return <ProjectsManager />;
}
