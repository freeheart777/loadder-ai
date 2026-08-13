import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Draggable } from "gsap/Draggable";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(
  ScrollTrigger,
  MotionPathPlugin,
  Draggable,
  SplitText,
  useGSAP
);

gsap.defaults({
  ease: "power3.out",
  duration: 0.8,
});

export {
  gsap,
  ScrollTrigger,
  MotionPathPlugin,
  Draggable,
  SplitText,
  useGSAP,
};