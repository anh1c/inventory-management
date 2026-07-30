from django.db import migrations


def seed_location_types(apps, schema_editor):
    StockLocationType = apps.get_model('stock', 'StockLocationType')

    for name, description in [
        ('Xưởng', 'Loại vị trí dành cho xưởng'),
        ('Công trường', 'Loại vị trí dành cho công trường'),
    ]:
        StockLocationType.objects.get_or_create(
            name=name,
            defaults={
                'description': description,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0119_alter_stockitemtestresult_date'),
    ]

    operations = [
        migrations.RunPython(seed_location_types, migrations.RunPython.noop),
    ]
