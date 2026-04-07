import { loadDashboardBundle } from "@/lib/data";
import DashboardClient from "./ui";

export default function Page() {
  const bundle = loadDashboardBundle();
  return <DashboardClient datasets={bundle.datasets} />;
}
