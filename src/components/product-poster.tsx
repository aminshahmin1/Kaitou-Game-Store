"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductPoster({ src, title, priority = false }: { src?: string | null; title: string; priority?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = src?.startsWith("https://") && src !== failedSource ? src : "/brand/logo-current.png";
  return <div className="relative aspect-square w-full overflow-hidden bg-[#071225]" data-product-poster>
    <Image src={source} alt={`${title} game artwork`} fill sizes="(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw"
      unoptimized priority={priority} className="object-contain" referrerPolicy="no-referrer"
      onError={() => { if (src && source === src) setFailedSource(src); }} />
  </div>;
}
