import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function DemoModePreserver() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("demo") === "1") {
      localStorage.setItem("loadder-demo-mode", "1");
      return;
    }

    const demoMode = localStorage.getItem("loadder-demo-mode");

    if (demoMode === "1") {
      document.documentElement.dataset.demo = "1";
    } else {
      delete document.documentElement.dataset.demo;
    }
  }, [location]);

  return null;
}
