"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SocialEditor = dynamic(() => import("@/components/social-editor/SocialEditor"), { ssr: false });
const InlineEditor = dynamic(() => import("@/components/social-editor/InlineEditor"), { ssr: false });

function EditorWithQuery() {
  const searchParams = useSearchParams();
  if (searchParams.get('inline') === '1') return <InlineEditor />;
  return <SocialEditor postId={searchParams.get("postId") || ""} />;
}

export default function SocialEditorPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-[#050910]" />}><EditorWithQuery /></Suspense>;
}
