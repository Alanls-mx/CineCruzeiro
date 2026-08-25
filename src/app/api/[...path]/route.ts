import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.CINE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_CINE_API_URL ||
  "http://localhost:4000";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join("/");
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`/api/${path}${sourceUrl.search}`, BACKEND_URL);
  const headers = new Headers();

  [
    "content-type",
    "authorization",
    "cookie",
    "x-idempotency-key",
    "x-signature",
    "x-request-id",
  ].forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });
  headers.set("x-forwarded-host", sourceUrl.host);
  headers.set("x-forwarded-proto", sourceUrl.protocol.replace(":", ""));

  const method = request.method.toUpperCase();
  const backendResponse = await fetch(targetUrl, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.text(),
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = backendResponse.headers.get("content-type");
  ["content-type", "location", "content-disposition", "cache-control"].forEach((name) => {
    const value = backendResponse.headers.get(name);
    if (value) responseHeaders.set(name, value);
  });

  const response = new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });

  const setCookies = getSetCookies(backendResponse.headers);
  setCookies.forEach((cookie) => response.headers.append("set-cookie", cookie));

  return response;
}

function getSetCookies(headers: Headers) {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
