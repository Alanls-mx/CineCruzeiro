import { ConcessionItem, Movie, TicketOrder } from "./index";

export type AdminRole = "owner" | "admin" | "operator" | "cashier";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  permissions?: string[];
  twoFactorEnabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AdminDashboardData {
  summary: {
    revenueToday: number;
    revenuePeriod: number;
    revenueComparePercent: number;
    ticketsSold: number;
    averageTicket: number;
    concessionRevenue: number;
    occupancyRate: number;
    activeSessions: number;
  };
  charts: {
    occupancyByHour: Array<{ hour: string; occupancy: number; tickets: number }>;
    revenueByDay: Array<{ date: string; revenue: number; tickets: number }>;
  };
  recentOrders: TicketOrder[];
}

export interface RoomSeatType {
  id: string;
  name: string;
  color: string;
  priceModifier?: number;
}

export interface RoomSeat {
  id: string;
  label: string;
  typeId?: string;
  enabled?: boolean;
  aisleAfter?: boolean;
  accessibility?: "wheelchair" | "obese" | "";
}

export interface RoomSeatRow {
  id: string;
  label: string;
  seats: RoomSeat[];
}

export interface RoomSeatLayout {
  enabled: boolean;
  screenLabel?: string;
  seatTypes: RoomSeatType[];
  rows: RoomSeatRow[];
}

export interface CinemaRoom {
  id: string;
  name: string;
  capacity: number;
  layout?: RoomSeatLayout;
  seatSelectionEnabled?: boolean;
}

export interface TicketType {
  id: string;
  name: string;
  description?: string;
  price: number;
  badge?: string;
  sortOrder?: number;
  active: boolean;
  bundleQuantity?: number;
}

export interface MarketingCoupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minPurchase?: number;
  maxUses?: number;
  usesCount?: number;
  validFrom?: string;
  validUntil?: string;
  active: boolean;
}

export interface MarketingBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  active: boolean;
  sortOrder?: number;
}

export interface ClubPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  ticketsPerMonth: number;
  ticketDiscountPercent: number;
  concessionDiscountPercent: number;
  includedFreeItemIds?: string[];
  excludedItemIds?: string[];
  maxRolloverCredits?: number;
  cancellationGraceDays?: number;
  active: boolean;
  accountingTicketAmount?: number;
  accountingBenefitAmount?: number;
}

export interface ClubSubscription {
  id: string;
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  planId: string;
  planName: string;
  status: "active" | "canceled" | "past_due" | "courtesy";
  creditsBalance: number;
  currentCycleStart: string;
  currentCycleEnd: string;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: string;
}

export interface ClubCreditLog {
  id: string;
  subscriptionId: string;
  customerEmail: string;
  movieTitle: string;
  sessionDate: string;
  creditsUsed: number;
  createdAt: string;
}

export interface AdminContentData {
  cinemaName?: string;
  movies: Movie[];
  rooms: CinemaRoom[];
  concessions: ConcessionItem[];
  ticketTypes: TicketType[];
  coupons: MarketingCoupon[];
  banners: MarketingBanner[];
  clubPlans: ClubPlan[];
  users: AdminUser[];
  settings?: {
    adminTwoFactorRequired?: boolean;
    onlineFeePercent?: number;
    whatsappSupportNumber?: string;
  };
}

export interface AdminIntegrationsStatus {
  mercadoPago: {
    configured: boolean;
    environment: "sandbox" | "production";
    publicKey: string;
    webhookUrl: string;
  };
  tmdb: {
    configured: boolean;
  };
  email: {
    configured: boolean;
    provider: "smtp" | "resend";
    fromEmail: string;
  };
}

export interface SystemLogEntry {
  id: string;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  ip?: string;
  actorEmail?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}
