import { loadDashboardBundle } from "@/lib/data";
import DashboardClient from "./ui";

export default function Page() {
  return <DashboardClient bundle={loadDashboardBundle()} />;
}
