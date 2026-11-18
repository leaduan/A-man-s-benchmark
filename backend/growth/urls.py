from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .admin_api import AdminGateView, AdminUserDetailView, AdminUserListView
from .auth import GateView, LoginView, LogoutView, MeView, RegisterView
from .views import (
    TaskViewSet, ScoreAreaViewSet, WeeklyScoreViewSet,
    StudySessionViewSet, WeeklyReviewViewSet,
    DashboardSummaryView, UserSettingsView
)

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'score-areas', ScoreAreaViewSet, basename='score-area')
router.register(r'weekly-scores', WeeklyScoreViewSet, basename='weekly-score')
router.register(r'study-sessions', StudySessionViewSet, basename='study-session')
router.register(r'weekly-reviews', WeeklyReviewViewSet, basename='weekly-review')

urlpatterns = [
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/gate/', GateView.as_view(), name='auth-gate'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<int:user_id>/', AdminUserDetailView.as_view(), name='admin-user'),
    path('admin/gate/', AdminGateView.as_view(), name='admin-gate'),
    path('dashboard-summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('settings/', UserSettingsView.as_view(), name='user-settings'),
    path('', include(router.urls)),
]
