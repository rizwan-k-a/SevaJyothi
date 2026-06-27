import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { ClosingCTA } from "@/components/landing/ClosingCTA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SevaJyothi — Rural infrastructure should never wait for signal" },
      { name: "description", content: "Offline-first infrastructure fault reporting for villages operating beyond the network edge. Built for Bharat." },
      { property: "og:title", content: "SevaJyothi" },
      { property: "og:description", content: "Offline-first infrastructure intelligence for rural India." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <ClosingCTA />
    </>
  );
}
