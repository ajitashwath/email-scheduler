"use client";

import { Typography } from "@mui/material";

/**
 * The Figma sidebar shows "ONB" set in a blocky, geometric, all-caps
 * wordmark with tight letter-spacing — distinct from the rest of the UI's
 * plain system font. We approximate that with a monospace stack at a heavy
 * weight and tightened tracking rather than shipping a custom font file.
 */
export default function Logo() {
  return (
    <Typography
      sx={{
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
        fontWeight: 800,
        fontSize: 28,
        letterSpacing: "-0.03em",
        color: "text.primary",
        lineHeight: 1,
      }}
    >
      ONB
    </Typography>
  );
}
