from django.contrib import admin
from .models import GateSettings, Task, ScoreArea, WeeklyScore, StudySession, WeeklyReview, UserSettings

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'priority', 'status', 'due_date', 'user')
    list_filter = ('category', 'priority', 'status', 'due_date')
    search_fields = ('title', 'description')

@admin.register(ScoreArea)
class ScoreAreaAdmin(admin.ModelAdmin):
    list_display = ('order', 'title', 'code', 'priority_tag')
    ordering = ('order',)

@admin.register(WeeklyScore)
class WeeklyScoreAdmin(admin.ModelAdmin):
    list_display = ('score_area', 'week_start', 'rating', 'user', 'created_at')
    list_filter = ('score_area', 'rating', 'week_start')
    search_fields = ('evidence',)

@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ('subject', 'date', 'duration_minutes', 'user')
    list_filter = ('subject', 'date')
    search_fields = ('subject', 'notes')

@admin.register(WeeklyReview)
class WeeklyReviewAdmin(admin.ModelAdmin):
    list_display = ('week_start', 'non_negotiable_1', 'user')
    search_fields = ('accomplishments', 'failures', 'lessons_learned')

@admin.register(GateSettings)
class GateSettingsAdmin(admin.ModelAdmin):
    list_display = ('registration_open', 'login_open')


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'major', 'target_execution_rate', 'weekly_study_pr_hours')
