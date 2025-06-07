import logging

logger = logging.getLogger(__name__)

class CorsLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        logger.info("CorsLoggingMiddleware initialized")

    def __call__(self, request):
        logger.info(f"Request path: {request.path}")
        response = self.get_response(request)
        logger.info(f"Response status: {response.status_code}")
        return response
