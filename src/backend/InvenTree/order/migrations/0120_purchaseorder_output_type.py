from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('order', '0119_contract_buyer_seller'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorder',
            name='output_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('workshop', 'Xưởng'),
                    ('construction_site', 'Công trường'),
                    ('commercial', 'Thương mại'),
                ],
                help_text='Select whether this purchase order serves workshop, construction site, or commercial output',
                max_length=32,
                null=True,
                verbose_name='Output Type',
            ),
        ),
    ]
