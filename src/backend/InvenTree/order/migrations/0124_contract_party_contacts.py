from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0080_company_internal_representative'),
        ('order', '0123_remove_purchaseorder_order_po_build_order_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='contract',
            name='party_a_contact',
            field=models.ForeignKey(
                blank=True,
                help_text='Representative contact for Party A',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='contracts_as_party_a',
                to='company.contact',
                verbose_name='Party A Contact',
            ),
        ),
        migrations.AddField(
            model_name='contract',
            name='party_b_contact',
            field=models.ForeignKey(
                blank=True,
                help_text='Representative contact for Party B',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='contracts_as_party_b',
                to='company.contact',
                verbose_name='Party B Contact',
            ),
        ),
    ]
