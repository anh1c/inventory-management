from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0079_auto_20260212_1054'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='representative',
            field=models.CharField(blank=True, help_text='Primary legal representative for this company', max_length=250, verbose_name='Representative'),
        ),
        migrations.AddField(
            model_name='company',
            name='representative_position',
            field=models.CharField(blank=True, help_text='Position or title of the primary legal representative', max_length=250, verbose_name='Representative Position'),
        ),
        migrations.AddField(
            model_name='company',
            name='is_internal',
            field=models.BooleanField(default=False, help_text='Is this company part of the owning company group?', verbose_name='Is internal company'),
        ),
        migrations.AddField(
            model_name='company',
            name='parent_company',
            field=models.ForeignKey(blank=True, help_text='Parent company for subsidiary companies', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subsidiaries', to='company.company', verbose_name='Parent Company'),
        ),
    ]
