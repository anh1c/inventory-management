from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('order', '0120_purchaseorder_output_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorderlineitem',
            name='sales_order_line',
            field=models.ForeignKey(
                blank=True,
                help_text='Sales order line item fulfilled by this purchase order line',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_order_line_items',
                to='order.salesorderlineitem',
                verbose_name='Sales Order Line Item',
            ),
        ),
    ]
