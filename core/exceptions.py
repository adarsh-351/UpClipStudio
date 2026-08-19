"""
Centralized Exception Architecture for UpClip Studio — Phase 19.
Provides structured, categorized exceptions with user-safe error messages
and optional internal debug context.
"""


class UpClipError(Exception):
    """Base exception for all UpClip Studio domain errors."""
    def __init__(self, message: str, user_message: str = None, category: str = "Application", error_code: str = "ERR_GENERAL"):
        super().__init__(message)
        self.message = message
        self.user_message = user_message or message
        self.category = category
        self.error_code = error_code

    def to_dict(self):
        return {
            "success": False,
            "error": self.user_message,
            "category": self.category,
            "code": self.error_code
        }


class ProjectError(UpClipError):
    def __init__(self, message: str, user_message: str = None, error_code: str = "ERR_PROJECT"):
        super().__init__(message, user_message, category="Project", error_code=error_code)


class ProjectNotFoundError(ProjectError):
    def __init__(self, project_id: str):
        super().__init__(
            message=f"Project with ID {project_id} was not found.",
            user_message="The requested project could not be found or has been moved.",
            error_code="ERR_PROJECT_NOT_FOUND"
        )


class ProjectValidationError(ProjectError):
    def __init__(self, message: str, details: str = None):
        super().__init__(
            message=f"Project validation failed: {message}. Details: {details}",
            user_message=f"Project data is invalid or corrupt: {message}",
            error_code="ERR_PROJECT_VALIDATION"
        )


class MediaError(UpClipError):
    def __init__(self, message: str, user_message: str = None, error_code: str = "ERR_MEDIA"):
        super().__init__(message, user_message, category="Media", error_code=error_code)


class MediaNotFoundError(MediaError):
    def __init__(self, filename: str):
        super().__init__(
            message=f"Media file '{filename}' not found on disk.",
            user_message=f"Media file '{filename}' is missing. Please relink or re-import the file.",
            error_code="ERR_MEDIA_NOT_FOUND"
        )


class RenderError(UpClipError):
    def __init__(self, message: str, user_message: str = None, error_code: str = "ERR_RENDER"):
        super().__init__(
            message=message,
            user_message=user_message or "Video rendering failed. Check logs for details.",
            category="Rendering",
            error_code=error_code
        )


class TaskCancelledError(UpClipError):
    def __init__(self, task_id: str):
        super().__init__(
            message=f"Task {task_id} was cancelled by user.",
            user_message="Operation was cancelled.",
            category="Task",
            error_code="ERR_TASK_CANCELLED"
        )
