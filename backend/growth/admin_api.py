from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth import clean_email
from .models import GateSettings, UserSettings
from .time import DEFAULT_TIMEZONE


def user_row(user):
    settings_obj = getattr(user, 'benchmark_settings', None)
    return {
        'id': user.id,
        'email': user.email,
        'student_name': settings_obj.student_name if settings_obj else '',
        'major': settings_obj.major if settings_obj else '',
        'is_admin': user.is_staff,
        'is_active': user.is_active,
        'joined': user.date_joined.date().isoformat(),
    }


def active_admins():
    return User.objects.filter(is_staff=True, is_active=True)


class AdminUserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = (
            User.objects.select_related('benchmark_settings')
            .annotate(task_count=Count('tasks'))
            .order_by('-is_staff', 'email')
        )
        rows = []
        for user in users:
            row = user_row(user)
            row['task_count'] = user.task_count
            rows.append(row)
        return Response(rows)

    def post(self, request):
        email = clean_email(request.data.get('email'))
        password = request.data.get('password') or ''
        name = (request.data.get('student_name') or '').strip()
        if not email:
            return Response({'email': ['Enter the email they will sign in with.']}, status=400)
        if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
            return Response({'email': ['An account with this email already exists.']}, status=400)
        try:
            validate_password(password, user=User(username=email, email=email))
        except ValidationError as exc:
            return Response({'password': list(exc.messages)}, status=400)
        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                is_staff=bool(request.data.get('is_admin')),
                is_active=request.data.get('is_active', True) is not False,
            )
            UserSettings.objects.create(
                user=user,
                student_name=name or email.split('@')[0],
                major=(request.data.get('major') or '').strip(),
                timezone=DEFAULT_TIMEZONE,
            )
        user = User.objects.select_related('benchmark_settings').get(pk=user.pk)
        return Response(user_row(user), status=201)


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _user(self, user_id):
        return User.objects.select_related('benchmark_settings').filter(pk=user_id).first()

    def patch(self, request, user_id):
        user = self._user(user_id)
        if user is None:
            return Response({'detail': 'Account not found.'}, status=404)
        email = clean_email(request.data.get('email')) if 'email' in request.data else user.email
        if not email:
            return Response({'email': ['Enter the email they will sign in with.']}, status=400)
        taken = User.objects.exclude(pk=user.pk).filter(username=email)
        taken_email = User.objects.exclude(pk=user.pk).filter(email=email)
        if taken.exists() or taken_email.exists():
            return Response({'email': ['An account with this email already exists.']}, status=400)

        is_admin = user.is_staff if 'is_admin' not in request.data else bool(request.data.get('is_admin'))
        is_active = user.is_active if 'is_active' not in request.data else bool(request.data.get('is_active'))
        if user.is_staff and user.is_active and not (is_admin and is_active):
            if active_admins().exclude(pk=user.pk).count() == 0:
                return Response({'detail': 'Keep at least one open admin account.'}, status=400)

        password = request.data.get('password') or ''
        if password:
            try:
                validate_password(password, user=user)
            except ValidationError as exc:
                return Response({'password': list(exc.messages)}, status=400)

        with transaction.atomic():
            user.username = email
            user.email = email
            user.is_staff = is_admin
            user.is_active = is_active
            if password:
                user.set_password(password)
            user.save()
            settings_obj, _ = UserSettings.objects.get_or_create(user=user)
            if 'student_name' in request.data:
                settings_obj.student_name = (request.data.get('student_name') or '').strip() or email.split('@')[0]
            if 'major' in request.data:
                settings_obj.major = (request.data.get('major') or '').strip()
            settings_obj.save()
        user = self._user(user.pk)
        return Response(user_row(user))

    def delete(self, request, user_id):
        user = self._user(user_id)
        if user is None:
            return Response({'detail': 'Account not found.'}, status=404)
        if user.pk == request.user.pk:
            return Response({'detail': 'Sign in as another admin before removing this account.'}, status=400)
        if user.is_staff and user.is_active and active_admins().exclude(pk=user.pk).count() == 0:
            return Response({'detail': 'Keep at least one open admin account.'}, status=400)
        user.delete()
        return Response(status=204)


class AdminGateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        gate = GateSettings.load()
        return Response({
            'registration_open': gate.registration_open,
            'login_open': gate.login_open,
            'panel_note': gate.panel_note,
        })

    def post(self, request):
        gate = GateSettings.load()
        if 'registration_open' in request.data:
            gate.registration_open = bool(request.data.get('registration_open'))
        if 'login_open' in request.data:
            gate.login_open = bool(request.data.get('login_open'))
        if 'panel_note' in request.data:
            gate.panel_note = (request.data.get('panel_note') or '').strip()[:500]
        gate.save()
        return Response({
            'registration_open': gate.registration_open,
            'login_open': gate.login_open,
            'panel_note': gate.panel_note,
        })
