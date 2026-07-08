"""
Pull substations from OpenStreetMap Overpass into the database.

Usage:
    # India bounding box (large — slow; OSM may rate-limit)
    python scripts/import_osm_substations.py \
        --south 8.0 --west 68.0 --north 37.0 --east 97.0

    # West Bengal only
    python scripts/import_osm_substations.py \
        --south 21.5 --west 86.0 --north 27.0 --east 89.9

    # Async via Celery (queues a task; requires worker)
    python scripts/import_osm_substations.py --async ...
"""

from __future__ import annotations

import argparse
import sys
from main import create_app
from Services import OSMService


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--south', type= float, required= True)
    parser.add_argument('--west', type = float, required=True)
    parser.add_argument('--north', type = float, required=True)
    parser.add_argument('--east', type = float, required=True)
    parser.add_argument('--country', default='IN')
    parser.add_argument('--async', dest = 'run_async', action = 'store_true', help = 'Queue Celery task instead of running inline')
    args = parser.parse_args()

    if args.south >= args.north:
        sys.exit('South must be < north')
    if args.west >= args.east:
        sys.exit('west must be < east')

    app = create_app()
    with app.app_context():
        if args.run_async:
            from Tasks import import_osm_substations_task
            task = import_osm_substations_task.delay(
                {
                    'south': args.south,
                    'west': args.west,
                    'east': args.east,
                    'north': args.north,
                },
                country = args.country
            )
            print(f'Queued celery task : {task.id}')
        else:
            print(f'Fetching OSm substation in bbox'
                    f'({args.south,args.west}) -> ({args.north, args.east})')
            result = OSMService.import_bounding_box(
                south=args.south,west = args.west,
                north = args.north, east = args.east,
                country=args.country
            )
            print(f" created : {result['created']}")
            print(f"  updated : {result['updated']}")
            print(f"  skipped : {result['skipped']}")
            print(f"  total : {result['total']}")

if __name__ == '__main__':
    main()
