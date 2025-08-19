import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const handle = String(req.query.handle || "").trim().replace(/^@+/, "");
    if (!handle) return res.status(400).send("handle required");

    const candidates = [
      `https://unavatar.io/twitter/${handle}?fallback=false`,
      `https://unavatar.io/${handle}?fallback=false`,
    ];
    let got: Response | null = null;
    for (const url of candidates) {
      const r = await fetch(url, { redirect: "follow" });
      if (r.ok) { got = r as any; break; }
    }
    if (!got) {
      got = await fetch(`https://unavatar.io/${handle}?fallback=${encodeURIComponent("https://unavatar.io/fallback.png")}`, { redirect: "follow" }) as any;
    }
    if (!got?.ok) return res.status(404).send("not found");

    const buff = Buffer.from(await (got as any).arrayBuffer());
    res.setHeader("Content-Type", got.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).send(buff);
  } catch (e) {
    console.error(e);
    return res.status(500).send("proxy error");
  }
}
