import type { Metadata } from "next";
import { CanvasShell } from "../components/canvas-shell";

export const metadata: Metadata = {
  title: "Canvas preview · Cartograph",
};

export default function PreviewPage() {
  return <CanvasShell />;
}
