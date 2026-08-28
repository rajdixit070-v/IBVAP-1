from fastapi import HTTPException, status

class CameraNotFoundException(HTTPException):
    def __init__(self, camera_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=fCamera '{camera_id}' not found in the system.
        )

class RTSOConnectionFailedException(HTTPException):
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=fRTSP Stream Connection Failed: {reason}
        )
