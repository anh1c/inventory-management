from django.db import migrations, models


def migrate_warehouse_review_subtasks(apps, schema_editor):
    ProcurementSubtask = apps.get_model('common', 'ProcurementSubtask')
    ProcurementSubtask.objects.filter(
        status='pending',
        work_ticket__status='warehouse_review',
    ).update(status='waiting_approval')


class Migration(migrations.Migration):

    dependencies = [
        ('common', '0054_remove_workticket_assigned_to'),
    ]

    operations = [
        migrations.AlterField(
            model_name='procurementsubtask',
            name='status',
            field=models.CharField(
                choices=[
                    ('waiting_approval', 'Waiting Approval'),
                    ('pending', 'Pending'),
                    ('done', 'Done'),
                ],
                default='waiting_approval',
                max_length=16,
            ),
        ),
        migrations.RunPython(migrate_warehouse_review_subtasks, migrations.RunPython.noop),
    ]
