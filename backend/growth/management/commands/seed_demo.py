"""Load two demo students so a fresh database shows a full workspace.

Hasan Mahmud Reduan studies Geology. Abdullah Al Mamun studies Computer
Science and Engineering. Each account owns tasks, study sessions, weekly
scores, weekly reviews, and settings. The five score pillars are shared.

Safe to run on every deploy. An account that already has tasks is left
alone. Pass --reset to rebuild only these two demo workspaces.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from growth.models import (
    ScoreArea,
    StudySession,
    Task,
    TaskStatus,
    UserSettings,
    WeeklyReview,
    WeeklyScore,
)
from growth.time import DEFAULT_TIMEZONE

DEMO_PASSWORD = 'Demo-student-2026'
ZONE = ZoneInfo(DEFAULT_TIMEZONE)

AREAS = [
    {
        'order': 1,
        'code': 'academic_mastery',
        'title': 'Academic Mastery',
        'priority_tag': '1st Priority',
        'description': 'First-principles course understanding, problem-set mastery, rigorous exam preparation.',
    },
    {
        'order': 2,
        'code': 'scientific_thinking',
        'title': 'Scientific Thinking & Research',
        'priority_tag': '2nd Priority',
        'description': 'Literature review, hypothesis formulation, numerical simulations, analytical rigor.',
    },
    {
        'order': 3,
        'code': 'deep_work',
        'title': 'Deep Work & Limit-Breaking Discipline',
        'priority_tag': '3rd Priority',
        'description': 'Resisting cheap dopamine, sustaining uninterrupted focus, overcoming mental resistance.',
    },
    {
        'order': 4,
        'code': 'physical_stamina',
        'title': 'Physical Stamina & Recovery',
        'priority_tag': '4th Priority',
        'description': 'Sleep timing consistency, cardiovascular capacity, nutrition fueling mental stamina.',
    },
    {
        'order': 5,
        'code': 'character_integrity',
        'title': 'Character & Intellectual Honesty',
        'priority_tag': '5th Priority',
        'description': 'Admitting knowledge gaps without ego, keeping promises to oneself, relentless integrity.',
    },
]

STUDENTS = [
    {
        'email': 'reduan@mail.com',
        'first_name': 'Hasan',
        'last_name': 'Mahmud Reduan',
        'settings': {
            'student_name': 'Hasan Mahmud Reduan',
            'aspiration': 'Field geologist and earth scientist',
            'major': 'Geology',
            'gpa_target': '3.70 / 4.00',
            'target_execution_rate': 90,
            'weekly_study_pr_hours': 32,
            'longest_session_pr_minutes': 240,
            'timezone': DEFAULT_TIMEZONE,
            'weekly_intention': 'Close the petrology set and beat the 32-hour field-and-lab record',
        },
        'tasks': [
            ('Structural geology cross-section', 'Fold axis measured on the map, not copied from the key.', 'University Coursework', 'High', -6, 'Completed'),
            ('Mineralogy thin-section lab', 'Sections 1-6 identified, wrong feldspar calls written in the error list.', 'University Coursework', 'High', -5, 'Completed'),
            ('Sedimentology grain-size report', 'Histogram, sorting, and the sieve weights are in the report.', 'University Coursework', 'High', -3, 'Completed'),
            ('Paleontology sketch set', 'Twelve specimens drawn with scale and the formation name.', 'University Coursework', 'Medium', -4, 'Completed'),
            ('Stratigraphy column, week traverse', 'Column drafted from the field notes, contacts marked.', 'University Coursework', 'Medium', -2, 'Completed'),
            ('Field notebook, twelve localities', 'Each stop has a grid reference, lithology, and a sketch.', 'University Coursework', 'High', -1, 'Completed'),
            ('Petrology problem set, igneous textures', 'Every texture named from the thin section, not from memory of the lecture slide.', 'University Coursework', 'High', 2, 'In Progress'),
            ('Map interpretation for the midterm', 'Closed-book pass over the last three map sheets.', 'University Coursework', 'High', 3, 'Pending'),
            ('Bengal Basin literature notes', 'Two papers annotated, one stratigraphic column attempted in my own hand.', 'Research', 'Medium', 5, 'Pending'),
            ('QGIS points for the field traverse', 'Remaining localities plotted, attribute table filled.', 'Programming and Technical Skills', 'Low', 6, 'In Progress'),
            ('Press and Siever, sedimentary structures', 'One-page summary in my own words.', 'Reading', 'Medium', 4, 'Pending'),
            ('Lights out by 23:30 on field nights', 'Four nights in bed by 23:30, logged the same night.', 'Health and Fitness', 'Medium', 4, 'Pending'),
            ('One-sentence intention for the mapping week', 'One sentence on the settings card, specific enough to fail.', 'Personal Development', 'Low', 1, 'In Progress'),
            ('Return the department Brunton compass', 'Compass checked back in at the lab store before Friday.', 'Other', 'Low', 1, 'Pending'),
        ],
        'sessions': [
            (0, 'Mineralogy', 180, 'Thin sections 4-6, two feldspar calls corrected'),
            (1, 'Structural Geology', 150, 'Cross-section, fold axis measured twice'),
            (2, 'Sedimentology', 210, 'Grain-size histogram and the sieve table'),
            (3, 'Petrology', 120, 'Igneous textures, first six questions'),
            (4, 'Field Methods', 160, 'Notebook review, twelve localities'),
            (5, 'GIS', 90, 'QGIS points, half the traverse plotted'),
            (6, 'Stratigraphy', 140, 'Column drafted from the week traverse'),
            (7, 'Mineralogy', 100, 'Lab write-up, error list updated'),
            (8, 'Structural Geology', 160, 'Prior week map sheet'),
            (9, 'Sedimentology', 120, 'Sorting calculation'),
            (10, 'Petrology', 200, 'Texture set, first pass'),
            (11, 'Field Methods', 90, 'Locality sketches'),
            (12, 'Stratigraphy', 140, 'Contact notes'),
            (13, 'GIS', 110, 'Attribute table'),
            (14, 'Mineralogy', 80, 'Section 1 redraw'),
        ],
        'scores': {
            0: {
                'academic_mastery': (4, 'Closed six coursework items, including the twelve-locality field notebook. Two feldspar calls were wrong and are in the error list.'),
                'scientific_thinking': (3, 'Annotated two Bengal Basin papers. No stratigraphic column of my own yet.'),
                'deep_work': (4, 'Three blocks past 150 minutes. Phone stayed in the hall during the sedimentology report.'),
                'physical_stamina': (4, 'One full field day and two evening walks. Asleep before 23:30 on four nights.'),
                'character_integrity': (4, 'Wrote the wrong plagioclase call into the error list instead of erasing it.'),
            },
            -1: {
                'academic_mastery': (4, 'Structural cross-section finished with the fold axis measured, not copied from the key.'),
                'scientific_thinking': (3, 'One page on the Surma Basin. Stopped when the map sheet was due.'),
                'deep_work': (3, 'One 180-minute block. Two evenings split by messages.'),
                'physical_stamina': (5, 'Full field day, pack weight logged, in bed by 22:40.'),
                'character_integrity': (4, 'Reported the compass reading I was unsure about instead of rounding it.'),
            },
            -2: {
                'academic_mastery': (3, 'Stratigraphy quiz corrected. Two formation names were still mixed up.'),
                'scientific_thinking': (2, 'No research block. The lab reports took the week.'),
                'deep_work': (3, 'Sessions stayed under 90 minutes.'),
                'physical_stamina': (4, 'Three training walks, logged the same day.'),
                'character_integrity': (3, 'Delayed the grain-size spreadsheet by one day and wrote that down.'),
            },
        },
        'reviews': {
            0: {
                'accomplishments': 'Six coursework items are closed, including the twelve-locality field notebook. The longest block was 210 minutes on the grain-size report.',
                'failures': 'The petrology set is still open, and the QGIS traverse is only half plotted.',
                'distractions': 'Messages split two evening blocks.',
                'lessons_learned': 'The sedimentology block held when the phone was in the hall.',
                'next_week_improvements': 'Start the igneous textures on the first evening, before the map review.',
                'non_negotiable_1': 'Finish the petrology problem set without the lab key.',
                'non_negotiable_2': 'Plot the remaining field points in QGIS.',
                'non_negotiable_3': 'Lights out by 23:30 on study nights.',
            },
            -1: {
                'accomplishments': 'The structural cross-section and the mineralogy lab are closed.',
                'failures': 'Research notes stayed at two annotated pages.',
                'distractions': 'Left messages open during the first evening block.',
                'lessons_learned': 'Measuring the fold axis once is faster than redrawing it from memory the next day.',
                'next_week_improvements': 'Put the research block on the calendar before Thursday.',
                'non_negotiable_1': 'Close the thin-section set and list every wrong call.',
                'non_negotiable_2': 'One page of Bengal Basin notes in my own words.',
                'non_negotiable_3': 'In bed by 23:30 on four nights.',
            },
        },
    },
    {
        'email': 'amamun@mail.com',
        'first_name': 'Abdullah',
        'last_name': 'Al Mamun',
        'settings': {
            'student_name': 'Abdullah Al Mamun',
            'aspiration': 'Software engineer and systems builder',
            'major': 'Computer Science and Engineering',
            'gpa_target': '3.85 / 4.00',
            'target_execution_rate': 90,
            'weekly_study_pr_hours': 40,
            'longest_session_pr_minutes': 255,
            'timezone': DEFAULT_TIMEZONE,
            'weekly_intention': 'Finish the compiler lab and beat the 40-hour deep-work record',
        },
        'tasks': [
            ('Data structures assignment, balanced trees', 'Insert, delete, and the rotation cases written out and tested.', 'University Coursework', 'High', -6, 'Completed'),
            ('Operating systems lab, scheduling', 'FIFO, SJF, and round robin timed on the same trace.', 'University Coursework', 'High', -5, 'Completed'),
            ('Database schema in third normal form', 'Transitive dependency removed and the new tables loaded.', 'University Coursework', 'High', -4, 'Completed'),
            ('Algorithms problem set, graphs', 'Dijkstra and the two edge cases written without the solution sheet.', 'University Coursework', 'High', -3, 'Completed'),
            ('Computer networks worksheet', 'Every latency calculation shown, units included.', 'University Coursework', 'Medium', -2, 'Completed'),
            ('Discrete math proof set', 'Induction base and step written in full.', 'University Coursework', 'Medium', -1, 'Completed'),
            ('Software engineering SRS draft', 'Draft submitted with the open questions listed.', 'University Coursework', 'Low', -7, 'Completed'),
            ('Compiler lab, lexer', 'Hidden tests passing, the off-by-one written in the error list.', 'University Coursework', 'High', 1, 'In Progress'),
            ('Operating systems midterm review', 'Closed-book pass over processes, memory, and deadlocks.', 'University Coursework', 'High', 3, 'Pending'),
            ('Query planner paper notes', 'One systems paper, half a page in my own words.', 'Research', 'Medium', 5, 'Pending'),
            ('Cache simulator, miss path', 'Miss path runs and the hit-rate plot is saved.', 'Programming and Technical Skills', 'Medium', 6, 'In Progress'),
            ('CS:APP chapter on linking', 'One-page summary of the link steps in my own words.', 'Reading', 'Medium', 4, 'Pending'),
            ('Three gym sessions, logged the same day', 'Three sessions done and written down the same day.', 'Health and Fitness', 'Medium', 4, 'Pending'),
            ('Weekly intention on the settings card', 'One sentence, specific enough to fail.', 'Personal Development', 'Low', 1, 'In Progress'),
            ('Office-hours question on deadlock', 'One written question taken to office hours.', 'Other', 'Low', 2, 'Pending'),
        ],
        'sessions': [
            (0, 'Algorithms', 200, 'Graph set, Dijkstra edge cases written out'),
            (1, 'Operating Systems', 180, 'Scheduling traces, three policies timed'),
            (2, 'Databases', 240, 'Schema to third normal form, sample rows loaded'),
            (3, 'Algorithms', 150, 'Shortest path review'),
            (4, 'Computer Networks', 120, 'Latency worksheet'),
            (5, 'Programming', 160, 'Lexer, one hidden test still failing'),
            (6, 'Discrete Mathematics', 90, 'Induction proofs'),
            (7, 'Operating Systems', 140, 'Process table notes'),
            (8, 'Databases', 180, 'Prior week schema draft'),
            (9, 'Algorithms', 150, 'Graph notes'),
            (10, 'Programming', 210, 'Cache simulator, first miss path'),
            (11, 'Operating Systems', 120, 'Deadlock examples'),
            (12, 'Computer Networks', 160, 'Worksheet corrections'),
            (13, 'Discrete Mathematics', 100, 'Proof review'),
            (14, 'Programming', 90, 'Build fix'),
        ],
        'scores': {
            0: {
                'academic_mastery': (4, 'Graph problem set finished without the solution sheet. Two Dijkstra edge cases are written out.'),
                'scientific_thinking': (3, 'Read the query-planner notes through section 3. No experiment of my own yet.'),
                'deep_work': (5, 'One 240-minute database block. The phone was in another room.'),
                'physical_stamina': (3, 'One gym session. Two nights ran past midnight before the lab deadline.'),
                'character_integrity': (4, 'Logged the off-by-one in the lexer instead of calling the lab done.'),
            },
            -1: {
                'academic_mastery': (5, 'Scheduling lab passed the hidden tests on the resubmit. Every policy was timed on the same trace.'),
                'scientific_thinking': (2, 'No paper this week. Coursework took the evenings.'),
                'deep_work': (4, 'Four blocks longer than 120 minutes.'),
                'physical_stamina': (3, 'Gym twice. Sleep drifted on Thursday.'),
                'character_integrity': (4, 'Stated the schema was not in third normal form, then removed the transitive dependency.'),
            },
            -2: {
                'academic_mastery': (4, 'Discrete math proofs written in full, including the induction base.'),
                'scientific_thinking': (3, 'Skimmed one systems paper and wrote half a page in my own words.'),
                'deep_work': (3, 'Longest block was 150 minutes.'),
                'physical_stamina': (2, 'No training. Three nights ended after 01:00.'),
                'character_integrity': (4, 'Kept the promise to start the SRS draft on Monday.'),
            },
        },
        'reviews': {
            0: {
                'accomplishments': 'Seven coursework items are done. The 240-minute database block is the longest this month.',
                'failures': 'The lexer still fails one hidden test, and the midterm review has not started.',
                'distractions': 'A browser tab stayed open through the first programming block.',
                'lessons_learned': 'The long block held when the phone was in the other room.',
                'next_week_improvements': 'Start the operating systems review on the first evening, not after the lexer.',
                'non_negotiable_1': 'Finish the compiler lexer against the hidden tests.',
                'non_negotiable_2': 'One page of query-planner notes in my own words.',
                'non_negotiable_3': 'Three gym sessions, logged the same day.',
            },
            -1: {
                'accomplishments': 'The scheduling lab and the database schema are closed.',
                'failures': 'Started the systems paper late and did not finish the page.',
                'distractions': 'Left a browser tab open during the first evening block.',
                'lessons_learned': 'Writing the failing test first made the schema mistake obvious.',
                'next_week_improvements': 'Schedule the research block before Thursday.',
                'non_negotiable_1': 'Close the graph problem set without the solution sheet.',
                'non_negotiable_2': 'Remove the transitive dependency in the schema.',
                'non_negotiable_3': 'Gym twice, and in bed by midnight on four nights.',
            },
        },
    },
]


def _today():
    return timezone.now().astimezone(ZONE).date()


def _at(day, hour=18, minute=30):
    return datetime.combine(day, time(hour, minute), tzinfo=ZONE)


class Command(BaseCommand):
    help = 'Seed Geology and CSE demo students across every workspace table.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete and rebuild only the two demo workspaces.',
        )

    def handle(self, *args, **options):
        for area in AREAS:
            ScoreArea.objects.update_or_create(code=area['code'], defaults=area)
        areas = {area.code: area for area in ScoreArea.objects.all()}

        today = _today()
        monday = today - timedelta(days=today.weekday())
        reset = options['reset']

        for spec in STUDENTS:
            self._seed_student(spec, areas, today, monday, reset)
        self._seed_admin()

        self.stdout.write(self.style.SUCCESS(
            'Demo students ready. Sign in as reduan@mail.com (Geology) or '
            f'amamun@mail.com (CSE). Password: {DEMO_PASSWORD}'
        ))

    def _seed_student(self, spec, areas, today, monday, reset):
        email = spec['email']
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    'email': email,
                    'first_name': spec['first_name'],
                    'last_name': spec['last_name'],
                },
            )
            user.email = email
            user.first_name = spec['first_name']
            user.last_name = spec['last_name']
            if created or reset or not user.has_usable_password():
                user.set_password(DEMO_PASSWORD)
            user.save()

            if Task.objects.filter(user=user).exists() and not reset:
                self.stdout.write(f'{email} already has a workspace. Skipping.')
                return

            Task.objects.filter(user=user).delete()
            WeeklyScore.objects.filter(user=user).delete()
            StudySession.objects.filter(user=user).delete()
            WeeklyReview.objects.filter(user=user).delete()

            coursework = [row for row in spec['tasks'] if row[2] == 'University Coursework']
            done = sum(1 for row in coursework if row[5] == 'Completed')
            execution = round((done / len(coursework)) * 100) if coursework else 0

            for title, description, category, priority, offset, status in spec['tasks']:
                due = today + timedelta(days=offset)
                Task.objects.create(
                    user=user,
                    title=title,
                    description=description,
                    category=category,
                    priority=priority,
                    due_date=due,
                    status=status,
                    completed_at=_at(due) if status == TaskStatus.COMPLETED else None,
                )

            StudySession.objects.bulk_create([
                StudySession(
                    user=user,
                    subject=subject,
                    date=today - timedelta(days=offset),
                    duration_minutes=minutes,
                    notes=notes,
                )
                for offset, subject, minutes, notes in spec['sessions']
            ])

            WeeklyScore.objects.bulk_create([
                WeeklyScore(
                    user=user,
                    score_area=areas[code],
                    week_start=monday + timedelta(weeks=week),
                    rating=rating,
                    evidence=evidence,
                )
                for week, pillars in spec['scores'].items()
                for code, (rating, evidence) in pillars.items()
            ])

            WeeklyReview.objects.bulk_create([
                WeeklyReview(
                    user=user,
                    week_start=monday + timedelta(weeks=week),
                    **fields,
                )
                for week, fields in spec['reviews'].items()
            ])

            settings_obj, _ = UserSettings.objects.get_or_create(user=user)
            for field, value in spec['settings'].items():
                setattr(settings_obj, field, value)
            settings_obj.current_execution_rate = execution
            settings_obj.save()

        self.stdout.write(self.style.SUCCESS(f'Seeded {email}.'))

    def _seed_admin(self):
        """One staff row in the same user table. Password is set only on first create."""
        email = 'admin@mail.com'
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=email,
                defaults={'email': email, 'first_name': 'Admin'},
            )
            user.email = email
            user.is_staff = True
            user.is_active = True
            if created or not user.has_usable_password():
                user.set_password(DEMO_PASSWORD)
            user.save()
            settings_obj, _ = UserSettings.objects.get_or_create(user=user)
            if created or not settings_obj.student_name:
                settings_obj.student_name = 'Administrator'
                settings_obj.major = ''
                settings_obj.timezone = DEFAULT_TIMEZONE
                settings_obj.save()
        self.stdout.write(self.style.SUCCESS(f'Admin ready: {email}'))
