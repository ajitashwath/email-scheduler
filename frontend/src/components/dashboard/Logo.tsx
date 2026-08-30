"use client";

import Image from "next/image";

export default function Logo() {
  return (
    <Image
      src="/onb-logo.png"
      alt="ONB"
      width={84}
      height={37}
      priority
      style={{ width: 84, height: 37, objectFit: "contain" }}
    />
  );
}
