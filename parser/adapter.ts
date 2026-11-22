import type { SourceFile } from "ts-morph";

export type FrameworkAdapter = {
  name: string;
  classifyFile(path: string, sourceFile: SourceFile): string | null;
};

export const fallbackAdapter: FrameworkAdapter = {
  name: "none",
  classifyFile() {
    return null;
  },
};
