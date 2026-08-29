"""What a grounded-chat call actually costs. Pure, no network.

Purpose
    The spend guard cannot enforce a ceiling it cannot price. Rather than
    trusting OpenRouter's own invoice after the fact, every call's cost is
    computed the instant its token counts are known, from the same per-model
    prices `ai-model-strategy.md` §2 Job 1 measured -- so the guard can refuse
    the *next* call before it is placed, not just report the last one.

Dependencies
    None. A model outside this table is a configuration error, not a $0
    guess: raising here is what stops a silently-unmetered model from being
    wired in by mistake.

Usage
    cost = estimate_cost_usd("qwen/qwen3-235b-a22b-2507", input_tokens=800, output_tokens=200)
"""

from __future__ import annotations

from typing import Final

#: (input $/M tokens, output $/M tokens), from ai-model-strategy.md Job 1.
#: Update this table, not a call site, when a price changes or a model is
#: swapped -- it is the one place either fact is allowed to live.
_PRICING_PER_MILLION_TOKENS: Final[dict[str, tuple[float, float]]] = {
    "qwen/qwen3-235b-a22b-2507": (0.0875, 0.3500),
    "deepseek/deepseek-v4-flash": (0.0868, 0.1736),
    "qwen/qwen3-30b-a3b-instruct-2507": (0.0481, 0.1930),
}


class UnknownModelPricingError(KeyError):
    """A model was used that this table has no price for.

    Raised rather than assumed $0, because an unmetered model is exactly how
    a spend guard gets quietly defeated.
    """


def estimate_cost_usd(model: str, *, input_tokens: int, output_tokens: int) -> float:
    """The USD cost of one completion, from its own token counts."""
    prices = _PRICING_PER_MILLION_TOKENS.get(model)
    if prices is None:
        raise UnknownModelPricingError(
            f"No price is recorded for model {model!r}. Add it to "
            "_PRICING_PER_MILLION_TOKENS before using it for grounded chat."
        )
    input_per_million, output_per_million = prices
    return (input_tokens * input_per_million + output_tokens * output_per_million) / 1_000_000
