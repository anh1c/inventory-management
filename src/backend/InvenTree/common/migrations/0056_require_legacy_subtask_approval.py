from django.db import migrations


def require_approval_for_legacy_subtasks(apps, schema_editor):
    ProcurementSubtask = apps.get_model('common', 'ProcurementSubtask')
    ProcurementSubtask.objects.filter(
        status='pending', warehouse_approved_by__isnull=True
    ).update(status='waiting_approval')


class Migration(migrations.Migration):
    dependencies = [('common', '0055_procurement_subtask_waiting_approval')]

    operations = [migrations.RunPython(require_approval_for_legacy_subtasks, migrations.RunPython.noop)]
