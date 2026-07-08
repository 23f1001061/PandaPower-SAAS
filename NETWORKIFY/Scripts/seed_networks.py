"""
Seed IEEE test networks (case9, case14, case30, case39, case57, case118,
mv_oberrhein) into the database as public templates.

Usage:
    python scripts/seed_networks.py
    python scripts/seed_networks.py --user admin --templates case9 case14
"""
from __future__ import annotations
import argparse
import sys

from main import create_app
from extension import db
from Models import Users, UserRole, PowerNetwork
from Services import PandapowerService

_DEFAULT_TEMPLATES = (
    'case9', 'case14', 'case30','case39',
    'case57', 'case118', 'mv_oberrhein'
)


def _pick_owner(username : str | None) -> Users:
    if username:
        u = Users.query.filter_by(username = username).first()
        if u is None:
            sys.exit(f"Users '{username}' not found")
        return u
    admin = (Users.query.filter_by(role = UserRole.ADMIN, is_active = True).first())
    if admin is None:
        sys.exit('No Admin User found, run "flask create-admin" first.')
    return admin



def seed(templates: tuple[str, ...], owner_username : str | None = None, overwrite : bool = False) -> None:
    app = create_app()
    with app.app_context():
        owner = _pick_owner(owner_username)
        print(f'Seeding templates as owner : {owner.username}')
        for tpl in templates:
            if tpl not in PandapowerService.AVAILABLE_TEMPLATES:
                print(f' | Skipping Unknown Template : {tpl}')
                continue
            existing = (PowerNetwork.query.filter_by(template_name = tpl, is_template = True).first())
            if existing and not overwrite:
                print(f" -{tpl} : already seeded (id = {existing.id}), skipping")
                continue
            if existing and overwrite:
                print(f' ~ {tpl} : deleting existing id = {existing.id}')
                db.session.delete(existing)
                db.session.commit()

            net = PowerNetwork(
                user_id     = owner.id,
                name        = f"IEEE {tpl}",
                description = f"Standard pandapower bundled test case: {tpl}",
                is_template = True,
                template_name = tpl,
                is_public   = True,
                base_mva    = 100.0,
                freq_hz     = 50.0,
            )
            db.session.add(net)
            db.session.commit()

            try:
                PandapowerService.load_template_into_db(net.id, tpl)
                print(f' ✓ {tpl}: loaded (network id={net.id})')
            except Exception as e:
                db.session.rollback()
                print(f"  ✗ {tpl}: failed — {e}")


def main():
    parser = argparse.ArgumentParser(description= __doc__)
    parser.add_argument('--user', help = 'Username to assign templates to (default: first active admin)')
    parser.add_argument('--templates', nargs= '+', default= list(_DEFAULT_TEMPLATES),help = 'Templates to seed')
    parser.add_argument('--overwrite', action = 'store_true', help = 'Delete + reload existing seeds')
    args = parser.parse_args()
    seed(tuple(args.templates),owner_username= args.user, overwrite= args.overwrite)


if __name__ == '__main__':
    main()
    