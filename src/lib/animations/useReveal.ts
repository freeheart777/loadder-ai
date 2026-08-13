import { useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  useGSAP,
} from "./gsap";

type RevealOptions = {
  y?: number;
  duration?: number;
  delay?: number;
  stagger?: number;
  selector?: string;
};

export function useReveal({
  y = 32,
  duration = 0.8,
  delay = 0,
  stagger = 0.08,
  selector = "[data-reveal]",
}: RevealOptions = {}) {
  const scope = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const elements =
        gsap.utils.toArray<HTMLElement>(selector);

      if (!elements.length) return;

      gsap.set(elements, {
        opacity: 0,
        y,
      });

      ScrollTrigger.batch(elements, {
        start: "top 88%",

        onEnter: (batch) => {
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration,
            delay,
            stagger,
            clearProps: "transform",
          });
        },

        once: true,
      });
    },
    {
      scope,
    }
  );

  return scope;
}