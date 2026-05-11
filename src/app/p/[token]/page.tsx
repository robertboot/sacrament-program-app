import { renderPublishedProgramByToken } from "../_lib/render-published";

export const dynamic = "force-dynamic"; // always fetch latest — no caching

export default async function PublicShare({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return await renderPublishedProgramByToken(token);
}
