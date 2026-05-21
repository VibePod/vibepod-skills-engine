import path from "node:path";

import { emit, flush, logError } from "../utils/output.js";
import { validateSkill } from "../validation/validate-skill.js";

export async function validateCommand(skillPath: string): Promise<number> {
  const abs = path.resolve(skillPath);
  const result = await validateSkill(abs);
  emit(
    {
      command: "validate",
      path: result.path,
      ok: result.ok,
      errors: result.errors,
      ...(result.frontmatter ? { frontmatter: result.frontmatter } : {}),
    },
    () => {
      if (result.ok) return `validate ${abs}: OK`;
      return [`validate ${abs}: FAIL`, ...result.errors.map((e) => `  - ${e}`)].join("\n");
    },
  );
  flush();
  if (!result.ok) {
    logError("Validation failed");
    return 1;
  }
  return 0;
}
