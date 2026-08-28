"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CinemaContent, fetchCinemaContent, getCachedCinemaContent } from "@/services/cinemaApi";

export function useCinemaContent() {
  const cachedContent = getCachedCinemaContent();
  const [content, setContent] = useState<CinemaContent | null>(cachedContent);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(cachedContent ? "ready" : "loading");
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback((force = false) => {
    const currentRequest = ++requestId.current;
    setStatus("loading");
    setError("");
    fetchCinemaContent(force)
      .then((data) => {
        if (requestId.current !== currentRequest) return;
        setContent(data);
        setStatus("ready");
      })
      .catch(() => {
        if (requestId.current !== currentRequest) return;
        setError("Nao foi possivel carregar a programacao agora. Tente novamente em instantes.");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { content, status, error, retry: () => void load(true) };
}
