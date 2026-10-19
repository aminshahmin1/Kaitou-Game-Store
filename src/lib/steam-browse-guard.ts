import "server-only";
import { headers } from "next/headers";
import { guardRequest } from "./request-guard";
export async function steamBrowseLimited() {
  const incoming = await headers();
  const request = new Request(`https://${incoming.get("host") ?? "kaitou.shop"}/steam-gifts`, { headers: incoming });
  return Boolean(await guardRequest(request,"steam-library"));
}
