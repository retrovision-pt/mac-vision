import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAC Vision — Bem-vindo" },
      { name: "description", content: "MAC Vision — Mapa de Acompanhamento Comercial, lojas, vendas, escalas e Chat Vision." },
      { property: "og:title", content: "MAC Vision — Bem-vindo" },
      { property: "og:description", content: "Acesso ao MAC Vision e ao acompanhamento comercial das lojas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      className="mac-original-frame"
      src="/mac-vision/original.html"
      title="MAC Vision"
      allow="fullscreen; clipboard-write"
    />
  );
}
