from django.db import migrations


def add_vnd_currency_code(apps, schema_editor):
    InvenTreeSetting = apps.get_model('common', 'InvenTreeSetting')

    setting = InvenTreeSetting.objects.filter(key='CURRENCY_CODES').first()

    if setting is None:
        return

    codes = [code.strip().upper() for code in (setting.value or '').split(',') if code.strip()]

    if 'VND' not in codes:
        codes.append('VND')
        setting.value = ','.join(codes)
        setting.save(update_fields=['value'])


class Migration(migrations.Migration):

    dependencies = [
        ('common', '0041_auto_20251203_1244'),
    ]

    operations = [
        migrations.RunPython(add_vnd_currency_code, migrations.RunPython.noop),
    ]
