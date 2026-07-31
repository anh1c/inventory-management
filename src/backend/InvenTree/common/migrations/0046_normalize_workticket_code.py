import re

from django.db import migrations


def normalize_ticket_codes(apps, schema_editor):
    WorkTicket = apps.get_model('common', 'WorkTicket')

    for ticket in WorkTicket.objects.all():
        if match := re.fullmatch(r'CV-(\d+)', ticket.code):
            normalized = f'CV-{int(match.group(1)):07d}'
            if ticket.code != normalized:
                ticket.code = normalized
                ticket.save(update_fields=['code'])


class Migration(migrations.Migration):
    dependencies = [('common', '0045_alter_workticket_code')]

    operations = [migrations.RunPython(normalize_ticket_codes, migrations.RunPython.noop)]
