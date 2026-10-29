// TEMPORARY test page — delete the folder app/api/ai-test before submission.
//   /api/ai-test                        -> checks Gemini answers (uses 1 request of your quota)
//   /api/ai-test?need=measure+a+signal  -> tests smart matching against the real resources table
// Only works while running `npm run dev` on your laptop; returns 404 on the live site.
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { matchResources } from "@/app/actions/ai-match";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });

  const need = new URL(req.url).searchParams.get("need");
  if (need) return Response.json(await matchResources(need));

  const result = await runAi({
    feature: "test",
    schema: z.object({ hello: z.string() }),
    system: "Reply with a short friendly greeting.",
    messages: [{ role: "user", content: "Say hello to the LabPass team." }],
  });
  return Response.json(result);
}
