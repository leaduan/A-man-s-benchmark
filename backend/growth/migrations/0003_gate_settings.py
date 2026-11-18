from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('growth', '0002_accounts_and_dates'),
    ]

    operations = [
        migrations.CreateModel(
            name='GateSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('registration_open', models.BooleanField(default=True)),
                ('login_open', models.BooleanField(default=True)),
                ('panel_note', models.TextField(blank=True, default='Demo workspaces, already filled: reduan@mail.com (Geology) and amamun@mail.com (CSE). Password Demo-student-2026.')),
            ],
            options={
                'verbose_name': 'Sign-in panel',
                'verbose_name_plural': 'Sign-in panel',
            },
        ),
    ]
