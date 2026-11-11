import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from 'react';
import { mountMacBridge } from '@/lib/mac-bridge';

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
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!frame.current) return;
    const cleanup = mountMacBridge(frame.current);
    frame.current.src = '/mac-vision/original.html';
    return cleanup;
  }, []);
  return (
    <iframe
      ref={frame}
      className="mac-original-frame"
      src="about:blank"
      title="MAC Vision"
      allow="fullscreen; clipboard-write"
    />
  );
}
