import { loadDashboardData } from "@/lib/data";
import DashboardClient from "./ui";

export default function Page() {
  const data = loadDashboardData();
  return <DashboardClient data={data} />;
}

