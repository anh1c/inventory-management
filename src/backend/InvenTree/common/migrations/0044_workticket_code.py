from django.db import migrations, models


def populate_ticket_codes(apps, schema_editor):
    WorkTicket = apps.get_model('common', 'WorkTicket')

    for ticket in WorkTicket.objects.filter(code__isnull=True):
        ticket.code = f'CV-{ticket.pk:07d}'
        ticket.save(update_fields=['code'])


class Migration(migrations.Migration):
    dependencies = [('common', '0043_workticket')]

    operations = [
        migrations.AddField(
            model_name='workticket',
            name='code',
            field=models.CharField(max_length=64, null=True, verbose_name='Work Code'),
        ),
        migrations.RunPython(populate_ticket_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='workticket',
            name='code',
            field=models.CharField(max_length=64, unique=True, verbose_name='Work Code'),
        ),
    ]
