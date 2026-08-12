"use client";

import React from "react";
import CometCardDemo from "../../components/comet-card-demo";

export default function CometDemoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight text-white uppercase">
          3D Comet Card Demo
        </h1>
        <p className="text-xs text-zinc-500 mt-2">
          Hover over the card to see the 3D parallax tilt and glare effect.
        </p>
      </div>
      <CometCardDemo />
      <div className="mt-8">
        <a
          href="/"
          className="text-xs font-bold uppercase tracking-wider text-cherryRed hover:underline"
        >
          &larr; Back to App
        </a>
      </div>
    </div>
  );
}
