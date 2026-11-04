import { BUILTIN_TEMPLATES, getBuiltinTemplate, type BuiltinTemplate } from "../templates/builtin";
import type { Design } from "./engine/types";

/** Homepage showcase: a subset of the built-in templates (single source of truth: templates/builtin). */
const SHOWCASE_IDS = ["classic", "indigo-flow", "teal-dots", "sunset", "ink-bars", "evergreen"] as const;

export const SHOWCASE_STYLES: readonly BuiltinTemplate[] = SHOWCASE_IDS.map((id) => getBuiltinTemplate(id)!);

export const HERO_DESIGN: Design = getBuiltinTemplate("indigo-flow")!.design;

export { BUILTIN_TEMPLATES };
