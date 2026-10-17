// Checks the Bangla UI: every literal passed to tr() / trn() in src/ has an entry
// in src/lib/bn.ts, and each translation keeps the text's {slots}.
//
//   npm run check:i18n
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const bnFile = path.join(src, "lib", "bn.ts");

const parse = (file) =>
  ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

// The dictionary: the object literal's string keys and values.
const bn = new Map();
(function read(node) {
  if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && ts.isStringLiteral(node.initializer)) bn.set(node.name.text, node.initializer.text);
  ts.forEachChild(node, read);
})(parse(bnFile));

const used = new Map(); // key -> first place it's used
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && p !== bnFile) {
      const sf = parse(p);
      (function visit(n) {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "tr" || n.expression.text === "trn")) {
          const args = n.expression.text === "tr" ? n.arguments.slice(0, 1) : n.arguments.slice(1, 3);
          for (const a of args) {
            if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) {
              if (!used.has(a.text)) used.set(a.text, `${path.relative(root, p)}:${sf.getLineAndCharacterOfPosition(a.getStart()).line + 1}`);
            }
          }
        }
        ts.forEachChild(n, visit);
      })(sf);
    }
  }
};
walk(src);

const missing = [...used].filter(([k]) => !bn.has(k));
const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const broken = [...bn].filter(([k, v]) => slots(k).some((s) => !v.includes(`{${s}}`)));

for (const [k, where] of missing) console.log(`missing  ${where}  ${JSON.stringify(k)}`);
for (const [k] of broken) console.log(`slots    ${JSON.stringify(k)}`);
console.log(`${used.size} texts, ${bn.size} translations, ${missing.length} missing, ${broken.length} with lost {slots}`);
process.exit(missing.length || broken.length ? 1 : 0);
