/**
 * gitignore subset that matters for env files: comments, negation, trailing
 * slash (directory), anchored patterns, *, ?, and **. Last matching rule wins,
 * same as git.
 */

export interface IgnoreRule {
  negate: boolean;
  dirOnly: boolean;
  re: RegExp;
  basename: boolean;
  raw: string;
}

export function parseIgnore(text: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (let line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    if (line.endsWith(" ") && !line.endsWith("\\ ")) line = line.trimEnd();
    line = line.replace(/\\ /g, " ");
    if (!line.trim()) continue;

    let negate = false;
    if (line.startsWith("!")) {
      negate = true;
      line = line.slice(1);
    }
    if (line.startsWith("/")) line = line.slice(1);

    let dirOnly = false;
    if (line.endsWith("/")) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    if (!line) continue;

    rules.push({
      negate,
      dirOnly,
      re: globToRegExp(line),
      basename: !line.includes("/"),
      raw: line,
    });
  }
  return rules;
}

export function isIgnored(relPath: string, isDir: boolean, rules: IgnoreRule[]): boolean {
  const norm = relPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!norm) return false;
  const base = norm.slice(norm.lastIndexOf("/") + 1);
  let ignored = false;

  for (const rule of rules) {
    if (rule.dirOnly) {
      if (ruleMatches(norm, base, rule) && isDir) {
        ignored = !rule.negate;
        continue;
      }
      if (underDir(norm, rule)) ignored = !rule.negate;
      continue;
    }
    if (ruleMatches(norm, base, rule)) ignored = !rule.negate;
  }
  return ignored;
}

function ruleMatches(norm: string, base: string, rule: IgnoreRule): boolean {
  if (rule.re.test(norm)) return true;
  if (rule.basename && rule.re.test(base)) return true;
  return false;
}

function underDir(norm: string, rule: IgnoreRule): boolean {
  const parts = norm.split("/");
  for (let i = 0; i < parts.length - 1; i++) {
    const prefix = parts.slice(0, i + 1).join("/");
    const b = parts[i] ?? "";
    if (rule.re.test(prefix) || (rule.basename && rule.re.test(b))) return true;
  }
  return false;
}

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(ch)) {
      re += "\\" + ch;
    } else {
      re += ch;
    }
  }
  return new RegExp("^(?:" + re + ")$");
}
