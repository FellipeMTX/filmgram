"use client";

import { SocialRouteError } from "@/features/social/SocialRouteError";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <SocialRouteError route="library" retry={retry} />;
}
