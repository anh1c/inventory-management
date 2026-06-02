from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0080_company_internal_representative'),
        ('order', '0118_contract'),
    ]

    operations = [
        migrations.AddField(
            model_name='contract',
            name='buyer',
            field=models.ForeignKey(blank=True, help_text='Company buying under this contract', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contracts_as_buyer', to='company.company', verbose_name='Buyer'),
        ),
        migrations.AddField(
            model_name='contract',
            name='seller',
            field=models.ForeignKey(blank=True, help_text='Company selling under this contract', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contracts_as_seller', to='company.company', verbose_name='Seller'),
        ),
    ]
