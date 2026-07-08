from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_bcrypt import Bcrypt
from celery import Celery
import os

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO()
bcrypt = Bcrypt()
celery = Celery( "networkify",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=["Tasks.analysis_tasks", "Tasks.report_tasks", "Tasks.import_tasks", "Tasks.maintenance_tasks"],) 

def init_extensions(app):
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    socketio.init_app(
        app,
        message_queue = app.config['CELERY_BROKER_URL'],
        cors_allowed_origins= app.config["CORS_ORIGIN"],
        async_mode= "eventlet",
                )
    _init_celery(app)

def _init_celery(app):
    celery.conf.update(
        broker_url = app.config["CELERY_BROKER_URL"],
        result_backend = app.config["CELERY_RESULT_BACKEND"],
        task_serializer = 'json',
        result_serializer = 'json',
        accept_content = ['json'],
        timezone = "Asia/Kolkata",
        enable_utc = True,
        task_track_started = True,
    )
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    celery.Task = ContextTask