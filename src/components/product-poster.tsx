"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductPoster({ src, title, priority = false }: { src?: string | null; title: string; priority?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = src?.startsWith("https://") && src !== failedSource ? src : "/brand/logo-current.png";
  return <div className="grid h-36 w-full place-items-center overflow-hidden bg-[#071225]" data-product-poster>
    <Image src={source} alt={`${title} game artwork`} width={112} height={112}
      unoptimized priority={priority} className="h-28 w-28 rounded-md object-contain" referrerPolicy="no-referrer"
      onError={() => { if (src && source === src) setFailedSource(src); }} />
  </div>;
}
