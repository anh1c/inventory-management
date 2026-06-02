from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0121_seed_purchase_order_location_types'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE stock_stocklocation DROP COLUMN IF EXISTS destination_type;',
            reverse_sql='ALTER TABLE stock_stocklocation ADD COLUMN IF NOT EXISTS destination_type varchar(32) NULL;',
        ),
    ]
