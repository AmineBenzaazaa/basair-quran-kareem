import React, { useCallback } from "react";
import { type Href, useRouter } from "expo-router";
import { IconButton } from "./IconButton";

type Props = Omit<React.ComponentProps<typeof IconButton>, "name" | "onPress"> & {
  fallbackHref: string;
};

export function BackButton({ fallbackHref, ...props }: Props) {
  const router = useRouter();

  const handlePress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref as Href);
  }, [fallbackHref, router]);

  // arrow-back points LEFT regardless of RTL — correct for a left-side back button.
  return <IconButton name="arrow-back" onPress={handlePress} {...props} />;
}
