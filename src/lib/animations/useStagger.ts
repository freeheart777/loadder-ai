import { useRef } from "react";
import { gsap, useGSAP } from "./gsap";

export function useStagger(
  selector = "[data-stagger]"
) {
  const scope = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const items =
        gsap.utils.toArray<HTMLElement>(selector);

      if (!items.length) return;

      gsap.fromTo(
        items,
        {
          opacity: 0,
          y: 28,
          scale: 0.97,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.75,
          stagger: 0.08,
          ease: "power3.out",
        }
      );
    },
    {
      scope,
    }
  );

  return scope;
}