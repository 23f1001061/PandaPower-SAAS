"""
Celery worker entry point for NETWORKIFY.

Run the worker against THIS module, not extension.celery directly:

    celery -A celery_worker.celery worker --loglevel=info --pool=solo

Why this file exists
--------------------
The Celery tasks use db.session, which needs a Flask application
context. That context (and the Redis broker config) is wired up inside
create_app() -> init_extensions() -> _init_celery(), which attaches the
ContextTask wrapper to every task.

When you launch the worker straight from `extension.celery`, create_app()
never runs, so ContextTask is never attached and tasks crash with
"Working outside of application context".

Importing this module builds the Flask app first (running all that
wiring), then exposes the same `celery` object for the worker to use.
"""

import os
os.environ["NETWORKIFY_WORKER"] = "1"
from main import create_app
from extension import celery  # noqa: E402  (after monkey_patch on purpose)

# Building the app runs init_extensions -> _init_celery, which:
#   - applies the Redis broker/result config
#   - attaches ContextTask (gives every task an app context)
app = create_app()

# Push a default app context so any task can use db.session safely.
app.app_context().push()
