"""
Seed the Plan table with Free / Pro / Enterprise tiers.

Usage:
    python scripts/seed_plans.py
    python scripts/seed_plans.py --overwrite
"""
from __future__ import annotations

import argparse

from main import create_app
from extension import db
from Models import Plan, PlanTier


_PLANS = [
    dict(
        tier=PlanTier.FREE, name="Free",
        description="For students and individual exploration.",
        price_inr_per_month=0.0, price_inr_per_year=0.0,
        max_networks=3, max_buses_per_network=50,
        max_analyses_per_month=20, max_reports_per_month=5,
        max_facilities=5, max_org_members=1,
        allows_contingency=False, allows_opf=False, allows_timeseries=False,
        allows_pdf_branding=False, allows_api_access=False,
        allows_priority_compute=False,
    ),
    dict(
        tier=PlanTier.PRO, name="Pro",
        description="For consultant engineers and small firms.",
        price_inr_per_month=2499.0, price_inr_per_year=24999.0,
        max_networks=50, max_buses_per_network=500,
        max_analyses_per_month=500, max_reports_per_month=100,
        max_facilities=100, max_org_members=5,
        allows_contingency=True, allows_opf=True, allows_timeseries=True,
        allows_pdf_branding=True, allows_api_access=True,
        allows_priority_compute=False,
    ),
    dict(
        tier=PlanTier.ENTERPRISE, name="Enterprise",
        description="For large consultancies and utilities. Unlimited usage.",
        price_inr_per_month=None, price_inr_per_year=None,
        max_networks=None, max_buses_per_network=None,
        max_analyses_per_month=None, max_reports_per_month=None,
        max_facilities=None, max_org_members=None,
        allows_contingency=True, allows_opf=True, allows_timeseries=True,
        allows_pdf_branding=True, allows_api_access=True,
        allows_priority_compute=True,
    ),
]


def seed(overwrite: bool = False) -> None:
    app = create_app()
    with app.app_context():
        for cfg in _PLANS:
            tier = cfg["tier"]
            existing = Plan.query.filter_by(tier=tier).first()
            if existing and overwrite:
                for k, v in cfg.items():
                    setattr(existing, k, v)
                print(f"  ~ {tier.value}: updated")
            elif existing:
                print(f"  - {tier.value}: already exists, skipping")
            else:
                db.session.add(Plan(**cfg))
                print(f"  ✓ {tier.value}: created")
        db.session.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    seed(overwrite=args.overwrite)


if __name__ == "__main__":
    main()
