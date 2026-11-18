from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

class TaskCategory(models.TextChoices):
    UNIVERSITY_COURSEWORK = 'University Coursework', 'University Coursework (Academy #1)'
    RESEARCH = 'Research', 'Research'
    PROGRAMMING = 'Programming and Technical Skills', 'Programming & Technical Skills'
    READING = 'Reading', 'Reading'
    PERSONAL_DEV = 'Personal Development', 'Personal Development'
    HEALTH_FITNESS = 'Health and Fitness', 'Health & Fitness'
    OTHER = 'Other', 'Other'

class TaskPriority(models.TextChoices):
    HIGH = 'High', 'High Priority'
    MEDIUM = 'Medium', 'Medium Priority'
    LOW = 'Low', 'Low Priority'

class TaskStatus(models.TextChoices):
    PENDING = 'Pending', 'Pending'
    IN_PROGRESS = 'In Progress', 'In Progress'
    COMPLETED = 'Completed', 'Completed'

class Task(models.Model):
    """
    Task model with Academy First priority support.
    University Coursework strictly takes precedence over other categories.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, help_text="Standard of Completion (Definition of Done)")
    category = models.CharField(max_length=64, choices=TaskCategory.choices, default=TaskCategory.UNIVERSITY_COURSEWORK)
    priority = models.CharField(max_length=16, choices=TaskPriority.choices, default=TaskPriority.HIGH)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.status == TaskStatus.COMPLETED:
            if self.completed_at is None:
                self.completed_at = timezone.now()
        else:
            self.completed_at = None
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            kwargs['update_fields'] = set(update_fields) | {'completed_at'}
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['due_date', '-created_at']

    def __str__(self):
        return f"[{self.category}] {self.title} ({self.status})"

class ScoreArea(models.Model):
    """
    Core Evaluation Pillars:
    1. Academic Mastery (1st Priority)
    2. Scientific Thinking & Research
    3. Deep Work & Limit-Breaking Discipline
    4. Physical Stamina & Recovery
    5. Character & Intellectual Honesty
    """
    code = models.SlugField(max_length=64, unique=True)
    title = models.CharField(max_length=128)
    priority_tag = models.CharField(max_length=64, default="Core Pillar")
    description = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title

class WeeklyScore(models.Model):
    """
    Evidence-based self-evaluation on a 1-5 scale.
    Database constraint prevents duplicate scores for the same pillar and week.
    Mandatory objective evidence field enforces 'Evidence Over Feelings'.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weekly_scores')
    score_area = models.ForeignKey(ScoreArea, on_delete=models.CASCADE, related_name='scores')
    week_start = models.DateField(help_text="Monday of the evaluation week (YYYY-MM-DD)")
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1 = Very Poor, 5 = Limit-Breaking"
    )
    evidence = models.TextField(help_text="Mandatory objective evidence: concrete facts and metrics.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'score_area', 'week_start'],
                name='unique_user_score_area_week'
            )
        ]
        ordering = ['-week_start', 'score_area__order']

    def __str__(self):
        return f"{self.score_area.title} ({self.week_start}): {self.rating}/5"

class StudySession(models.Model):
    """
    Deep cognitive work session log.
    Used for 7-day, 30-day, all-time KPIs and Personal Record (PR) calculations.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_sessions')
    subject = models.CharField(max_length=128)
    date = models.DateField()
    duration_minutes = models.PositiveIntegerField(help_text="Duration in minutes")
    notes = models.TextField(blank=True, help_text="Concepts covered, derivations completed, or problem sets")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.subject} ({self.date}) - {self.duration_minutes}m"

class WeeklyReview(models.Model):
    """
    Structured Weekly Reflection & Debrief.
    Includes accomplishments, failures, distractions, lessons learned, and 3 Non-Negotiable priorities.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weekly_reviews')
    week_start = models.DateField()
    accomplishments = models.TextField(blank=True)
    failures = models.TextField(blank=True)
    distractions = models.TextField(blank=True)
    lessons_learned = models.TextField(blank=True)
    next_week_improvements = models.TextField(blank=True)
    non_negotiable_1 = models.CharField(max_length=255, help_text="Non-Negotiable Priority #1 (Academy Standing)")
    non_negotiable_2 = models.CharField(max_length=255, blank=True)
    non_negotiable_3 = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'week_start'], name='unique_user_week_review')
        ]
        ordering = ['-week_start']

    def __str__(self):
        return f"Review for Week of {self.week_start}"

class UserSettings(models.Model):
    """
    Personal benchmark settings and personal records (PRs) to beat.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='benchmark_settings')
    student_name = models.CharField(max_length=128, blank=True, default="")
    aspiration = models.CharField(max_length=255, blank=True, default="")
    major = models.CharField(max_length=128, blank=True, default="")
    gpa_target = models.CharField(max_length=32, blank=True, default="")
    current_execution_rate = models.FloatField(default=0)
    target_execution_rate = models.FloatField(default=90.0)
    weekly_study_pr_hours = models.FloatField(default=0)
    longest_session_pr_minutes = models.PositiveIntegerField(default=0)
    timezone = models.CharField(max_length=64, default="Asia/Dhaka")
    weekly_intention = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return f"Settings for {self.student_name}"


class GateSettings(models.Model):
    """One row that controls the public sign-in and registration card."""

    registration_open = models.BooleanField(default=True)
    login_open = models.BooleanField(default=True)
    panel_note = models.TextField(
        blank=True,
        default=(
            'Demo workspaces, already filled: reduan@mail.com (Geology) and '
            'amamun@mail.com (CSE). Password Demo-student-2026.'
        ),
    )

    class Meta:
        verbose_name = 'Sign-in panel'
        verbose_name_plural = 'Sign-in panel'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Sign-in panel'
