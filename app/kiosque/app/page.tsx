import { KiosqueHome } from "@/components/ai-hub/KiosqueHome";
import { getAiHubSession } from "@/lib/aiHub";

export default async function KiosqueHomePage() {
  const session = await getAiHubSession();
  const firstName = session.kind === "active" && !session.isAdmin ? session.name.trim().split(/\s+/)[0] : "";
  return <KiosqueHome firstName={firstName} />;
}
