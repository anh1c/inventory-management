from django.db import migrations, models
import django.db.models.deletion


def ensure_purchase_order_build_order_column(apps, schema_editor):
    """Create build_order_id only when it is missing.

    This keeps the migration recoverable if a previous migration attempt added the
    column but failed before Django recorded the migration as applied.
    """
    table = 'order_purchaseorder'
    column = 'build_order_id'
    existing_columns = {
        field.name for field in schema_editor.connection.introspection.get_table_description(
            schema_editor.connection.cursor(), table
        )
    }

    if column in existing_columns:
        return

    quote = schema_editor.quote_name

    schema_editor.execute(
        f'ALTER TABLE {quote(table)} ADD COLUMN {quote(column)} bigint NULL'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('build', '0058_buildline_consumed'),
        ('order', '0121_purchaseorderlineitem_sales_order_line'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    ensure_purchase_order_build_order_column,
                    reverse_code=migrations.RunPython.noop,
                )
            ],
            state_operations=[
                migrations.AddField(
                    model_name='purchaseorder',
                    name='build_order',
                    field=models.ForeignKey(
                        blank=True,
                        help_text='Build order linked to this workshop purchase order',
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='workshop_purchase_orders',
                        to='build.build',
                        verbose_name='Build Order',
                    ),
                )
            ],
        ),
        migrations.AddIndex(
            model_name='purchaseorder',
            index=models.Index(
                fields=['build_order'], name='order_po_build_order_idx'
            ),
        ),
        migrations.AddField(
            model_name='purchaseorderlineitem',
            name='build_line',
            field=models.ForeignKey(
                blank=True,
                help_text='Build order line item fulfilled by this purchase order line',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_order_line_items',
                to='build.buildline',
                verbose_name='Build Order Line Item',
            ),
        ),
    ]
