"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardModule from "@/components/admin/DashboardModule";
import MoviesModule from "@/components/admin/MoviesModule";
import RoomsModule from "@/components/admin/RoomsModule";
import SessionsModule from "@/components/admin/SessionsModule";
import OrdersModule from "@/components/admin/OrdersModule";
import ConcessionsModule from "@/components/admin/ConcessionsModule";
import MarketingModule from "@/components/admin/MarketingModule";
import ClubModule from "@/components/admin/ClubModule";
import UsersModule from "@/components/admin/UsersModule";
import IntegrationsModule from "@/components/admin/IntegrationsModule";
import LogsModule from "@/components/admin/LogsModule";

function AdminPageContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  switch (activeTab) {
    case "movies":
      return <MoviesModule />;
    case "rooms":
      return <RoomsModule />;
    case "sessions":
      return <SessionsModule />;
    case "orders":
      return <OrdersModule />;
    case "concessions":
      return <ConcessionsModule />;
    case "marketing":
      return <MarketingModule />;
    case "club":
      return <ClubModule />;
    case "users":
      return <UsersModule />;
    case "integrations":
      return <IntegrationsModule />;
    case "logs":
      return <LogsModule />;
    case "dashboard":
    default:
      return <DashboardModule />;
  }
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
