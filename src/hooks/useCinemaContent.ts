"use client";

import { useEffect, useState } from "react";
import { CinemaContent, fetchCinemaContent, getCachedCinemaContent } from "@/services/cinemaApi";

export function useCinemaContent() {
  const cachedContent = getCachedCinemaContent();
  const [content, setContent] = useState<CinemaContent | null>(cachedContent);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(cachedContent ? "ready" : "loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchCinemaContent()
      .then((data) => {
        if (!mounted) return;
        setContent(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!mounted) return;
        setError("Nao foi possivel carregar a programacao agora. Tente novamente em instantes.");
        setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { content, status, error };
}
