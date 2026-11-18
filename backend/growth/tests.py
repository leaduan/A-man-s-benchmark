from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APIClient
from django.test import TestCase

from growth.management.commands.seed_demo import DEMO_PASSWORD
from growth.models import (
    ScoreArea,
    StudySession,
    Task,
    UserSettings,
    WeeklyReview,
    WeeklyScore,
)


PASSWORD = 'Study-block-2026'


class AccountTests(TestCase):
    def test_anonymous_workspace_is_closed(self):
        client = APIClient()
        denied = client.get('/api/tasks/')
        self.assertIn(denied.status_code, (401, 403))
        me = client.get('/api/auth/me/')
        self.assertEqual(me.json()['authenticated'], False)
        self.assertIn('csrftoken', me.cookies)

    def test_register_starts_an_empty_private_workspace(self):
        client = APIClient()
        created = client.post('/api/auth/register/', {
            'email': 'ada@example.com',
            'password': PASSWORD,
            'student_name': 'Ada',
            'timezone': 'Asia/Dhaka',
        }, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()['student_name'], 'Ada')
        tasks = client.get('/api/tasks/')
        self.assertEqual(tasks.status_code, 200)
        self.assertEqual(tasks.json(), [])

    def test_students_cannot_see_each_others_tasks(self):
        ada = User.objects.create_user('ada@example.com', 'ada@example.com', PASSWORD)
        grace = User.objects.create_user('grace@example.com', 'grace@example.com', PASSWORD)
        Task.objects.create(user=ada, title='Ada problem set', status='Pending')
        client = APIClient()
        client.login(username='grace@example.com', password=PASSWORD)
        response = client.get('/api/tasks/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        self.assertFalse(Task.objects.filter(user=grace).exists())

    def test_completion_time_is_recorded_and_cleared(self):
        User.objects.create_user('ada@example.com', 'ada@example.com', PASSWORD)
        client = APIClient()
        client.login(username='ada@example.com', password=PASSWORD)
        created = client.post('/api/tasks/', {
            'title': 'Problem set 8',
            'category': 'University Coursework',
            'priority': 'High',
            'status': 'Pending',
        }, format='json')
        task_id = created.json()['id']
        self.assertIsNone(created.json()['completed_at'])
        done = client.post(f'/api/tasks/{task_id}/toggle_complete/')
        self.assertEqual(done.json()['status'], 'Completed')
        self.assertIsNotNone(done.json()['completed_at'])
        reopened = client.post(f'/api/tasks/{task_id}/toggle_complete/')
        self.assertEqual(reopened.json()['status'], 'Pending')
        self.assertIsNone(reopened.json()['completed_at'])

    def test_week_follows_the_student_timezone(self):
        user = User.objects.create_user('ada@example.com', 'ada@example.com', PASSWORD)
        # 20:00 UTC is 02:00 the next day in Dhaka.
        fixed = datetime(2026, 11, 18, 20, 0, tzinfo=dt_timezone.utc)
        StudySession.objects.create(user=user, subject='Algebra', date='2026-11-19', duration_minutes=30)
        client = APIClient()
        client.login(username='ada@example.com', password=PASSWORD)
        with patch('growth.time.timezone.now', return_value=fixed):
            response = client.get('/api/dashboard-summary/')
        self.assertEqual(response.status_code, 200)
        chart = response.json()['weekly_study_chart']
        self.assertEqual(chart[-1]['date'], '2026-11-19')
        self.assertEqual(chart[-1]['hours'], 0.5)
        self.assertEqual(response.json()['today'], '2026-11-19')

    def test_demo_seed_fills_both_students_and_can_rerun(self):
        call_command('seed_demo')
        reduan = User.objects.get(username='reduan@mail.com')
        before = reduan.tasks.count()
        call_command('seed_demo')
        reduan.refresh_from_db()
        self.assertEqual(reduan.tasks.count(), before)
        self.assertEqual(ScoreArea.objects.count(), 5)

        expected = {
            'reduan@mail.com': 'Geology',
            'amamun@mail.com': 'Computer Science and Engineering',
        }
        for email, major in expected.items():
            user = User.objects.get(username=email)
            self.assertTrue(user.check_password(DEMO_PASSWORD))
            self.assertEqual(UserSettings.objects.get(user=user).major, major)
            self.assertEqual(set(user.tasks.values_list('category', flat=True)), {
                'University Coursework', 'Research', 'Programming and Technical Skills',
                'Reading', 'Personal Development', 'Health and Fitness', 'Other',
            })
            self.assertEqual(set(user.tasks.values_list('status', flat=True)), {
                'Pending', 'In Progress', 'Completed',
            })
            self.assertTrue(user.tasks.filter(status='Completed', completed_at__isnull=False).exists())
            self.assertFalse(user.tasks.exclude(status='Completed').exclude(completed_at=None).exists())
            self.assertEqual(WeeklyScore.objects.filter(user=user).values('score_area').distinct().count(), 5)
            self.assertGreaterEqual(WeeklyReview.objects.filter(user=user).count(), 2)
            self.assertGreater(StudySession.objects.filter(user=user).count(), 0)

        client = APIClient()
        client.login(username='amamun@mail.com', password=DEMO_PASSWORD)
        tasks = client.get('/api/tasks/')
        self.assertEqual(tasks.status_code, 200)
        self.assertFalse(any('petrology' in row['title'].lower() for row in tasks.json()))
        dashboard = client.get('/api/dashboard-summary/')
        self.assertGreater(dashboard.json()['kpis']['study_hours_current'], 0)
        self.assertEqual(len(dashboard.json()['scoreboard_preview']), 5)
        self.assertTrue(all(pillar['rating'] > 0 for pillar in dashboard.json()['scoreboard_preview']))

    def test_admin_uses_the_same_user_table_and_controls_the_gate(self):
        student = User.objects.create_user('ada@example.com', 'ada@example.com', PASSWORD)
        admin = User.objects.create_user('admin@mail.com', 'admin@mail.com', PASSWORD, is_staff=True)
        student_client = APIClient()
        student_client.login(username='ada@example.com', password=PASSWORD)
        self.assertEqual(student_client.get('/api/auth/me/').json()['is_admin'], False)
        self.assertEqual(student_client.get('/api/admin/users/').status_code, 403)

        admin_client = APIClient()
        admin_client.login(username='admin@mail.com', password=PASSWORD)
        self.assertTrue(admin_client.get('/api/auth/me/').json()['is_admin'])
        created = admin_client.post('/api/admin/users/', {
            'email': 'new@mail.com',
            'password': PASSWORD,
            'student_name': 'New Student',
            'major': 'Geology',
            'is_admin': False,
            'is_active': True,
        }, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertFalse(created.json()['is_admin'])
        self.assertEqual(User.objects.filter(email='new@mail.com', is_staff=False).count(), 1)

        closed = admin_client.post('/api/admin/gate/', {
            'registration_open': False,
            'login_open': False,
            'panel_note': 'Sign-in is limited.',
        }, format='json')
        self.assertEqual(closed.status_code, 200)
        gate = APIClient().get('/api/auth/gate/')
        self.assertFalse(gate.json()['registration_open'])
        self.assertEqual(gate.json()['note'], 'Sign-in is limited.')

        blocked = APIClient().post('/api/auth/register/', {
            'email': 'late@mail.com',
            'password': PASSWORD,
            'student_name': 'Late',
        }, format='json')
        self.assertEqual(blocked.status_code, 403)

        student_login = APIClient().post('/api/auth/login/', {
            'email': 'ada@example.com',
            'password': PASSWORD,
        }, format='json')
        self.assertEqual(student_login.status_code, 403)
        admin_login = APIClient().post('/api/auth/login/', {
            'email': 'admin@mail.com',
            'password': PASSWORD,
        }, format='json')
        self.assertEqual(admin_login.status_code, 200)

        demote = admin_client.patch(f'/api/admin/users/{admin.id}/', {
            'is_admin': False,
        }, format='json')
        self.assertEqual(demote.status_code, 400)
        remove_self = admin_client.delete(f'/api/admin/users/{admin.id}/')
        self.assertEqual(remove_self.status_code, 400)

        closed_account = admin_client.patch(f'/api/admin/users/{student.id}/', {
            'is_active': False,
        }, format='json')
        self.assertEqual(closed_account.status_code, 200)
        denied = APIClient().post('/api/auth/login/', {
            'email': 'ada@example.com',
            'password': PASSWORD,
        }, format='json')
        self.assertEqual(denied.status_code, 400)
        self.assertIn('closed', denied.json()['detail'].lower())
