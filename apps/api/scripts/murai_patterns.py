"""Classify a set of node labels into a literary pattern.

Purpose
    ``structural_data.key_chiastic_nodes[]`` needs more than an ordered list:
    the badge draws a shape, so it has to know whether the shape is a chiasm
    with a pivot, a straight parallel, or neither. Murai encodes that only in
    his labels -- ``A B C D C' B' A'`` versus ``A B A' B'`` -- so the shape is
    derived here, once, deterministically, instead of being re-guessed by the
    client.

    Nothing in this module is interpretation. It reads the labels the author
    wrote and reports their arrangement; ``Q-015``'s "one scholar's reading"
    framing travels separately, as data on the structure row.

Key responsibilities
    - Strip the prime mark to get the label a node pairs with.
    - Name the arrangement: chiasm, parallel, sequence, or other.
    - Identify the pivot of a chiasm -- the one unpaired node.

Dependencies
    Standard library only.

Usage
    shape = classify(["A", "B", "C", "D", "C'", "B'", "A'"])
    shape.pattern      # 'chiasm'
    shape.centre       # 'D'
"""

from __future__ import annotations

from dataclasses import dataclass

#: Murai writes the prime mark as an ASCII apostrophe. The typographic
#: apostrophe appears in the workbooks too, in a handful of sheets.
_PRIME_MARKS = ("'", "\u2019")

CHIASM = "chiasm"
PARALLEL = "parallel"
SEQUENCE = "sequence"
OTHER = "other"


def pair_label(label: str) -> str:
    """The label a node pairs with: ``A'`` and ``A`` both pair on ``A``."""
    stripped = label.strip()
    for mark in _PRIME_MARKS:
        if stripped.endswith(mark):
            return stripped[: -len(mark)]
    return stripped


def is_primed(label: str) -> bool:
    """True for the second limb of a pair -- ``B'``, ``C'``."""
    return label.strip().endswith(_PRIME_MARKS)


@dataclass(frozen=True, slots=True)
class Shape:
    """What arrangement a unit's labels describe."""

    pattern: str
    centre: str | None


def classify(labels: list[str]) -> Shape:
    """Name the arrangement of one unit's node labels, in document order."""
    opening = [pair_label(one) for one in labels if not is_primed(one)]
    closing = [pair_label(one) for one in labels if is_primed(one)]
    if not closing:
        return Shape(pattern=SEQUENCE, centre=None)
    unpaired = [one for one in opening if one not in closing]
    paired = [one for one in opening if one in closing]
    if closing == list(reversed(paired)) and len(unpaired) <= 1:
        return Shape(pattern=CHIASM, centre=unpaired[0] if unpaired else None)
    if closing == paired and not unpaired:
        return Shape(pattern=PARALLEL, centre=None)
    return Shape(pattern=OTHER, centre=unpaired[0] if len(unpaired) == 1 else None)
