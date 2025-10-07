"use client";
import dynamic from "next/dynamic";

export default function Page() {
  const Scene = dynamic(() => import("../components/Scene"), { ssr: false });
  return (
    <main className="h-screen w-screen bg-black">
      <Scene />
    </main>
  );
}
