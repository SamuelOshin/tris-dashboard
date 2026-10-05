"""
Source scanners for the transferability test (not a test module).

They read the pipeline code and report two kinds of environment dependence: a fixed value that
names something belonging to one environment, and a branch on an identifier. They are a tripwire
for the plausible ways of special-casing a dataset, not a proof; the tests exercise the scanners
themselves on code that does it each way.
"""

import ast

# Names that stand for "which data is this": comparing one with a fixed value is special-casing.
IDENTIFIERS = {
    "dataset_id",
    "material_id",
    "supplier_id",
    "category",
    "currency",
    "unit_of_measure",
    "description",
    "name",
    "product_sku",
}
# Keying a lookup by these picks a configuration per dataset or category.
KEY_IDENTIFIERS = {"dataset_id", "category", "currency", "unit_of_measure"}
TEXT_CALLS = {"startswith", "endswith", "lower", "upper", "casefold"}


def _names(node: ast.AST) -> set[str]:
    return {
        getattr(n, "id", getattr(n, "attr", ""))
        for n in ast.walk(node)
        if isinstance(n, (ast.Name, ast.Attribute))
    }


def _is_fixed(node: ast.AST) -> bool:
    """A fixed text, an all-capitals constant, or a list/tuple/set/dict of fixed texts."""
    if isinstance(node, ast.Constant):
        return isinstance(node.value, str)
    if isinstance(node, ast.Name):
        return node.id.isupper()
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return any(_is_fixed(e) for e in node.elts)
    return False


def _docstring_ids(tree: ast.AST) -> set[int]:
    owners = (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
    return {
        id(n.body[0].value)
        for n in ast.walk(tree)
        if isinstance(n, owners)
        and n.body
        and isinstance(n.body[0], ast.Expr)
        and isinstance(n.body[0].value, ast.Constant)
    }


def literal_violations(source: str, forbidden: set[str], prefixes: tuple[str, ...]) -> list[str]:
    """String literals (not docstrings) naming an environment's part, vendor, category or column."""
    tree = ast.parse(source)
    skip = _docstring_ids(tree)
    lowered = {f.lower() for f in forbidden}
    found = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Constant) and isinstance(node.value, str)):
            continue
        if id(node) in skip:
            continue
        text = node.value
        if text.lower() in lowered or (
            prefixes and text.lower().startswith(tuple(x.lower() for x in prefixes))
        ):
            found.append(f"{node.lineno}: {text!r}")
    return found


def branch_violations(source: str) -> list[str]:
    """Branches that special-case a dataset, material, supplier, category, currency or unit."""
    found = []
    for node in ast.walk(ast.parse(source)):
        where = getattr(node, "lineno", 0)
        if isinstance(node, ast.Compare):
            sides = [node.left, *node.comparators]
            if _names(node) & IDENTIFIERS and any(_is_fixed(s) for s in sides):
                found.append(f"{where}: comparison of an identifier with a fixed value")
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if (
                node.func.attr in {"startswith", "endswith"}
                and _names(node.func.value) & IDENTIFIERS
            ):
                found.append(f"{where}: text test on an identifier")
        elif isinstance(node, ast.Subscript):
            table = node.value
            is_constant_table = (isinstance(table, ast.Name) and table.id.isupper()) or isinstance(
                table, ast.Dict
            )  # a fixed table picked by dataset/category, not a running total per currency
            if is_constant_table and _names(node.slice) & KEY_IDENTIFIERS:
                found.append(f"{where}: fixed table keyed by a dataset or category")
        elif isinstance(node, ast.Match):
            if _names(node.subject) & IDENTIFIERS:
                found.append(f"{where}: match on an identifier")
    return found
