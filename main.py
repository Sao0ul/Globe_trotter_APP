#!/usr/bin/env python3

import os
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup
import tinycss2

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".svn",
    ".idea",
    ".next",
    "dist",
    "build",
    "__pycache__"
}

HTML_EXT = {".html", ".htm"}
CSS_EXT = {".css"}
JS_EXT = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}


# ==========================================================
# HTML
# ==========================================================

def html_node_name(tag):
    result = tag.name

    if tag.get("id"):
        result += f"#{tag['id']}"

    if tag.get("class"):
        for c in tag["class"]:
            result += f".{c}"

    return result


def walk_html(tag, prefix, output):
    children = [c for c in tag.children if getattr(c, "name", None)]

    for i, child in enumerate(children):
        last = i == len(children) - 1

        connector = "└── " if last else "├── "
        output.append(prefix + connector + html_node_name(child))

        next_prefix = prefix + ("    " if last else "│   ")

        walk_html(child, next_prefix, output)


def extract_html(file_path):
    output = []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            soup = BeautifulSoup(f.read(), "lxml")

        roots = []

        if soup.html:
            roots.append(soup.html)
        else:
            roots = [x for x in soup.children if getattr(x, "name", None)]

        for root in roots:
            output.append(f"├── {html_node_name(root)}")
            walk_html(root, "│   ", output)

    except Exception as e:
        output.append(f"└── HTML_PARSE_ERROR: {e}")

    return output


# ==========================================================
# CSS
# ==========================================================

def extract_css(file_path):
    selectors = set()

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            css = f.read()

        rules = tinycss2.parse_stylesheet(
            css,
            skip_comments=True,
            skip_whitespace=True
        )

        for rule in rules:
            if hasattr(rule, "prelude"):
                text = tinycss2.serialize(rule.prelude)

                for sel in re.findall(
                    r'[.#][a-zA-Z_-][a-zA-Z0-9_-]*',
                    text
                ):
                    selectors.add(sel)

                for tag in re.findall(
                    r'(?<![#.])\b[a-zA-Z][a-zA-Z0-9_-]*\b',
                    text
                ):
                    selectors.add(tag)

    except Exception:
        pass

    return [f"├── {x}" for x in sorted(selectors)]


# ==========================================================
# JS / TS
# ==========================================================

IMPORT_RE = re.compile(
    r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]'
)

FUNCTION_RE = re.compile(
    r'(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\((.*?)\)',
    re.S
)

ARROW_RE = re.compile(
    r'(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>',
    re.S
)

CLASS_RE = re.compile(
    r'class\s+([A-Za-z_$][A-Za-z0-9_$]*)'
)

METHOD_RE = re.compile(
    r'^\s*(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\((.*?)\)\s*\{',
    re.M
)


def extract_js(file_path):
    output = []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            src = f.read()

        imports = IMPORT_RE.findall(src)

        if imports:
            output.append("├── imports")

            for imp in imports:
                output.append(f"│   ├── {imp}")

        classes = {}

        for m in CLASS_RE.finditer(src):
            class_name = m.group(1)
            start = m.end()

            brace = 0
            body_start = None

            for i in range(start, len(src)):
                if src[i] == "{":
                    body_start = i
                    brace = 1
                    break

            if body_start is None:
                continue

            body_end = body_start

            for i in range(body_start + 1, len(src)):
                if src[i] == "{":
                    brace += 1
                elif src[i] == "}":
                    brace -= 1

                if brace == 0:
                    body_end = i
                    break

            body = src[body_start:body_end]

            methods = []

            for meth in METHOD_RE.finditer(body):
                name = meth.group(1)

                if name == "constructor":
                    continue

                params = meth.group(2).strip()

                methods.append(f"{name}({params})")

            classes[class_name] = methods

        for fn in FUNCTION_RE.findall(src):
            output.append(
                f"├── function {fn[0]}({fn[1].strip()})"
            )

        for fn in ARROW_RE.findall(src):
            output.append(
                f"├── function {fn[0]}({fn[1].strip()})"
            )

        for cls, methods in classes.items():
            output.append(f"├── class {cls}")

            for method in methods:
                output.append(f"│   ├── {method}")

    except Exception as e:
        output.append(f"├── JS_PARSE_ERROR: {e}")

    return output


# ==========================================================
# TREE
# ==========================================================

def analyze_file(path):
    ext = path.suffix.lower()

    if ext in HTML_EXT:
        return extract_html(path)

    if ext in CSS_EXT:
        return extract_css(path)

    if ext in JS_EXT:
        return extract_js(path)

    return []


def build_tree(directory, prefix=""):
    lines = []

    entries = sorted(
        [x for x in directory.iterdir()
         if x.name not in IGNORED_DIRS],
        key=lambda p: (p.is_file(), p.name.lower())
    )

    for idx, entry in enumerate(entries):
        last = idx == len(entries) - 1

        connector = "└── " if last else "├── "

        if entry.is_dir():
            lines.append(prefix + connector + entry.name + "/")

            new_prefix = prefix + (
                "    " if last else "│   "
            )

            lines.extend(
                build_tree(entry, new_prefix)
            )

        else:
            lines.append(prefix + connector + entry.name)

            sub_prefix = prefix + (
                "    " if last else "│   "
            )

            for item in analyze_file(entry):
                lines.append(sub_prefix + item)

    return lines


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

    result = [root.name + "/"]
    result.extend(build_tree(root))

    output_file = root / "architecture.tree"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(result))

    print(f"[OK] {output_file}")


if __name__ == "__main__":
    main()
