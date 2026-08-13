import { useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  useGSAP,
} from "./gsap";

export function useCounter(
  endValue: number,
  duration = 1.5
) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useGSAP(() => {
    if (!ref.current) return;

    const counter = {
      value: 0,
    };

    gsap.to(counter, {
      value: endValue,
      duration,
      ease: "power2.out",

      scrollTrigger: {
        trigger: ref.current,
        start: "top 90%",
        once: true,
      },

      onUpdate: () => {
        if (!ref.current) return;

        ref.current.textContent =
          Math.round(counter.value).toLocaleString(
            "fa-IR"
          );
      },
    });
  });

  return ref;
}