import { fixtureValue } from "./target.ts";

export { fixtureValue } from "./target.ts";
export const importedValue = fixtureValue;
export const loadFixture = () => import("./target.ts");
