"""Per-run API spend guards."""

from dataclasses import dataclass, field


@dataclass
class RunBudget:
    max_usd: float = 2.0
    spent_usd: float = field(default=0.0, init=False)

    def add(self, amount: float) -> None:
        self.spent_usd += max(0.0, amount)

    def would_exceed(self, amount: float) -> bool:
        return (self.spent_usd + amount) > self.max_usd

    def remaining(self) -> float:
        return max(0.0, self.max_usd - self.spent_usd)
