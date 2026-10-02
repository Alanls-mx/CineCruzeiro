"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { measurementConsentKey } from "@/utils/tracking";

export function PrivacyMeasurementControl() {
  const [error, setError] = useState("");
  const refuse = () => {
    try {
      window.localStorage.setItem(measurementConsentKey, "denied");
      // Reload also stops third-party scripts already loaded in this document.
      window.location.reload();
    } catch {
      setError("Não foi possível salvar. Bloqueie os dados de medição nas configurações do navegador.");
    }
  };
  return (
    <div className="mt-4">
      <button type="button" onClick={refuse} className="inline-flex min-h-11 items-center gap-2 rounded bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />Recusar medição neste navegador
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
