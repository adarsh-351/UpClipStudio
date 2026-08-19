"""
Centralized Background Task & Progress Management Architecture for UpClip Studio — Phase 19.
Provides thread-safe job tracking, real progress reporting, step logging, and cancellation.
"""

import time
import threading
import uuid
from typing import Any, Callable, Dict, List, Optional

from core.constants import (
    TASK_STATUS_IDLE,
    TASK_STATUS_LOADING,
    TASK_STATUS_PROCESSING,
    TASK_STATUS_COMPLETED,
    TASK_STATUS_FAILED,
    TASK_STATUS_CANCELLED
)
from core.logger import logger


class Task:
    def __init__(self, task_id: str, name: str, category: str = "General", total_steps: int = 100):
        self.task_id = task_id
        self.name = name
        self.category = category
        self.status = TASK_STATUS_IDLE
        self.progress = 0  # 0 to 100
        self.step_message = "Initialized"
        self.current_step = 0
        self.total_steps = max(1, total_steps)
        self.error_message: Optional[str] = None
        self.result_data: Optional[Dict[str, Any]] = None
        self.created_at = time.time()
        self.updated_at = time.time()
        self.finished_at: Optional[float] = None
        self.cancellation_requested = False
        self.cancel_callback: Optional[Callable[[], None]] = None
        self.logs: List[str] = []
        self._lock = threading.Lock()

    def update_progress(self, current_step: int, message: str = ""):
        with self._lock:
            self.current_step = current_step
            self.progress = min(100, max(0, int(round((current_step / self.total_steps) * 100))))
            if message:
                self.step_message = message
                self.logs.append(f"[{time.strftime('%H:%M:%S')}] {message}")
            self.status = TASK_STATUS_PROCESSING
            self.updated_at = time.time()

    def complete(self, result_data: Optional[Dict[str, Any]] = None, message: str = "Completed"):
        with self._lock:
            self.status = TASK_STATUS_COMPLETED
            self.progress = 100
            self.step_message = message
            self.result_data = result_data or {}
            self.finished_at = time.time()
            self.updated_at = time.time()
            self.logs.append(f"[{time.strftime('%H:%M:%S')}] [SUCCESS] {message}")
            logger.app(f"Task '{self.name}' ({self.task_id}) completed successfully.")

    def fail(self, error_message: str):
        with self._lock:
            self.status = TASK_STATUS_FAILED
            self.error_message = error_message
            self.step_message = f"Error: {error_message}"
            self.finished_at = time.time()
            self.updated_at = time.time()
            self.logs.append(f"[{time.strftime('%H:%M:%S')}] [ERROR] {error_message}")
            logger.app(f"Task '{self.name}' ({self.task_id}) failed: {error_message}", level="error")

    def cancel(self):
        with self._lock:
            self.cancellation_requested = True
            self.status = TASK_STATUS_CANCELLED
            self.step_message = "Cancelled by user"
            self.finished_at = time.time()
            self.updated_at = time.time()
            self.logs.append(f"[{time.strftime('%H:%M:%S')}] [CANCELLED] Operation cancelled by user.")

        if self.cancel_callback:
            try:
                self.cancel_callback()
            except Exception as e:
                logger.app(f"Error during task cancel callback: {e}", level="warning")

    def is_cancelled(self) -> bool:
        with self._lock:
            return self.cancellation_requested

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "taskId": self.task_id,
                "name": self.name,
                "category": self.category,
                "status": self.status,
                "progress": self.progress,
                "stepMessage": self.step_message,
                "currentStep": self.current_step,
                "totalSteps": self.total_steps,
                "errorMessage": self.error_message,
                "resultData": self.result_data,
                "createdAt": self.created_at,
                "updatedAt": self.updated_at,
                "finishedAt": self.finished_at,
                "logs": self.logs[-20:]  # Return last 20 log entries
            }


class TaskManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._tasks: Dict[str, Task] = {}
            return cls._instance

    def create_task(self, name: str, category: str = "General", total_steps: int = 100) -> Task:
        task_id = f"task_{int(time.time() * 1000)}_{uuid.uuid4().hex[:4]}"
        task = Task(task_id, name, category, total_steps)
        with self._lock:
            self._tasks[task_id] = task
        logger.app(f"Registered new background task: '{name}' [{task_id}]")
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        with self._lock:
            return self._tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        task = self.get_task(task_id)
        if task:
            task.cancel()
            return True
        return False

    def list_active_tasks(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                t.to_dict() for t in self._tasks.values()
                if t.status in (TASK_STATUS_IDLE, TASK_STATUS_LOADING, TASK_STATUS_PROCESSING)
            ]


task_manager = TaskManager()
