"use client";

import NextError from "next/error";
import { useEffect } from "react";

// Last-resort boundary (replaces the root layout): reports errors no other error.tsx caught.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* The App Router doesn't expose a status code for errors; 0 renders the generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
