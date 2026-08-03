"""JSON serializers for common components."""

from django.contrib.contenttypes.models import ContentType
from django.db.models import BooleanField, Case, Count, OuterRef, Q, Subquery, Value, When
from django.urls import reverse
from django.utils.timezone import now
from django.utils.translation import gettext_lazy as _

import django_q.models
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from error_report.models import Error
from flags.state import flag_state
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

import common.filters
import common.models as common_models
import common.validators
import generic.states.custom
from importer.registry import register_importer
from InvenTree.helpers import get_objectreference
from InvenTree.helpers_model import construct_absolute_url
from InvenTree.mixins import DataImportExportSerializerMixin
from InvenTree.models import InvenTreeParameterMixin
from InvenTree.serializers import (
    ContentTypeField,
    FilterableSerializerMixin,
    InvenTreeAttachmentSerializerField,
    InvenTreeImageSerializerField,
    InvenTreeModelSerializer,
    OptionalField,
)
from plugin import registry as plugin_registry
from users.serializers import OwnerSerializer, UserSerializer


@extend_schema_field(OpenApiTypes.STR)
class SettingsValueField(serializers.Field):
    """Custom serializer field for a settings value."""

    def get_attribute(self, instance):
        """Return the object instance, not the attribute value."""
        return instance

    def to_representation(self, instance: common_models.InvenTreeSetting):
        """Return the value of the setting.

        Protected settings are returned as '***'
        """
        if instance.protected:
            return '***'
        else:
            value = instance.value

            if value is None:
                value = ''

            # Attempt to coerce the value to a native type
            if instance.is_int():
                value = instance.as_int()

            elif instance.is_float():
                value = instance.as_float()

            elif instance.is_bool():
                value = instance.as_bool()

            return value

    def to_internal_value(self, data) -> str:
        """Return the internal value of the setting."""
        if data is None:
            return ''
        else:
            return str(data)


class SettingsSerializer(InvenTreeModelSerializer):
    """Base serializer for a settings object."""

    key = serializers.CharField(read_only=True)

    name = serializers.CharField(read_only=True)

    description = serializers.CharField(read_only=True)

    type = serializers.CharField(source='setting_type', read_only=True)

    choices = serializers.SerializerMethodField()

    def get_choices(self, obj) -> list:
        """Returns the choices available for a given item."""
        results = []

        choices = obj.choices()

        if choices:
            for choice in choices:
                results.append({'value': choice[0], 'display_name': choice[1]})

        return results

    model_name = serializers.CharField(read_only=True, allow_null=True)

    model_filters = serializers.DictField(read_only=True)

    api_url = serializers.CharField(read_only=True, allow_null=True)

    value = SettingsValueField(allow_null=True)

    def validate_value(self, value):
        """Validate the value of the setting."""
        if value is None:
            return ''
        return str(value)

    units = serializers.CharField(read_only=True)

    required = serializers.BooleanField(read_only=True)

    typ = serializers.CharField(read_only=True)

    confirm = serializers.BooleanField(
        read_only=True,
        help_text=_('Indicates if changing this setting requires confirmation'),
    )

    confirm_text = serializers.CharField(read_only=True)

    def is_valid(self, *, raise_exception=False):
        """Validate the setting, including confirmation if required."""
        ret = super().is_valid(raise_exception=raise_exception)
        # Check if confirmation was provided if required
        if self.instance.confirm():
            req_data = self.context['request'].data
            if not 'manual_confirm' in req_data or not req_data['manual_confirm']:
                raise serializers.ValidationError({
                    'manual_confirm': _(
                        'This setting requires confirmation before changing. Please confirm the change.'
                    )
                })
        return ret


class GlobalSettingsSerializer(SettingsSerializer):
    """Serializer for the InvenTreeSetting model."""

    class Meta:
        """Meta options for GlobalSettingsSerializer."""

        model = common_models.InvenTreeSetting
        fields = [
            'pk',
            'key',
            'value',
            'name',
            'description',
            'type',
            'units',
            'choices',
            'model_name',
            'api_url',
            'typ',
            'read_only',
            'confirm',
            'confirm_text',
        ]

    read_only = serializers.SerializerMethodField(
        read_only=True,
        help_text=_(
            'Indicates if the setting is overridden by an environment variable'
        ),
        label=_('Override'),
    )

    def get_read_only(self, obj) -> bool:
        """Return True if the setting 'read_only' (cannot be edited).

        A setting may be "read-only" if:

        - It is overridden by an environment variable.
        """
        from common.settings import global_setting_overrides

        overrides = global_setting_overrides()
        return obj.key in overrides


class UserSettingsSerializer(SettingsSerializer):
    """Serializer for the InvenTreeUserSetting model."""

    class Meta:
        """Meta options for UserSettingsSerializer."""

        model = common_models.InvenTreeUserSetting
        fields = [
            'pk',
            'key',
            'value',
            'name',
            'description',
            'user',
            'type',
            'units',
            'choices',
            'model_name',
            'api_url',
            'typ',
            'confirm',
            'confirm_text',
        ]

    user = serializers.PrimaryKeyRelatedField(read_only=True)


class CurrencyExchangeSerializer(serializers.Serializer):
    """Serializer for a Currency Exchange request.

    It's only purpose is describing the results correctly in the API schema right now.
    """

    base_currency = serializers.CharField(read_only=True)
    exchange_rates = serializers.DictField(child=serializers.FloatField())
    updated = serializers.DateTimeField(read_only=True)


class GenericReferencedSettingSerializer(SettingsSerializer):
    """Serializer for a GenericReferencedSetting model.

    Args:
        MODEL: model class for the serializer
        EXTRA_FIELDS: fields that need to be appended to the serializer
            field must also be defined in the custom class
    """

    MODEL = None
    EXTRA_FIELDS = None

    def __init__(self, *args, **kwargs):
        """Init overrides the Meta class to make it dynamic."""

        class CustomMeta:
            """Scaffold for custom Meta class."""

            fields = [
                'pk',
                'key',
                'value',
                'name',
                'description',
                'type',
                'choices',
                'model_name',
                'model_filters',
                'api_url',
                'typ',
                'units',
                'required',
                'confirm',
                'confirm_text',
            ]

        # set Meta class
        self.Meta = CustomMeta
        self.Meta.model = self.MODEL
        # extend the fields
        self.Meta.fields.extend(self.EXTRA_FIELDS)

        # resume operations
        super().__init__(*args, **kwargs)

    def validate_value(self, value):
        """Validate the value of the setting."""
        if value is None:
            return ''
        return str(value)


class NotificationMessageSerializer(InvenTreeModelSerializer):
    """Serializer for the InvenTreeUserSetting model."""

    class Meta:
        """Meta options for NotificationMessageSerializer."""

        model = common_models.NotificationMessage
        fields = [
            'pk',
            'target',
            'source',
            'user',
            'category',
            'name',
            'message',
            'creation',
            'age',
            'age_human',
            'read',
        ]

        read_only_fields = [
            'category',
            'name',
            'message',
            'creation',
            'age',
            'age_human',
        ]

    target = serializers.SerializerMethodField(read_only=True)
    source = serializers.SerializerMethodField(read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    read = serializers.BooleanField()

    def get_target(self, obj) -> dict:
        """Function to resolve generic object reference to target."""
        target = get_objectreference(obj, 'target_content_type', 'target_object_id')

        if target and 'link' not in target:
            # Check if object has an absolute_url function
            if hasattr(obj.target_object, 'get_absolute_url'):
                target['link'] = obj.target_object.get_absolute_url()
            else:
                # check if user is staff - link to admin
                request = self.context.get('request')
                if request and request.user and request.user.is_staff:
                    meta = obj.target_object._meta

                    try:
                        target['link'] = construct_absolute_url(
                            reverse(
                                f'admin:{meta.db_table}_change',
                                kwargs={'object_id': obj.target_object_id},
                            )
                        )
                    except Exception:
                        # Do not crash if the reverse lookup fails
                        pass

        return target

    def get_source(self, obj) -> dict:
        """Function to resolve generic object reference to source."""
        return get_objectreference(obj, 'source_content_type', 'source_object_id')


class NewsFeedEntrySerializer(InvenTreeModelSerializer):
    """Serializer for the NewsFeedEntry model."""

    class Meta:
        """Meta options for NewsFeedEntrySerializer."""

        model = common_models.NewsFeedEntry
        fields = [
            'pk',
            'feed_id',
            'title',
            'link',
            'published',
            'author',
            'summary',
            'read',
        ]

    read = serializers.BooleanField()


class ConfigSerializer(serializers.Serializer):
    """Serializer for the InvenTree configuration.

    This is a read-only serializer.
    """

    key = serializers.CharField(read_only=True)
    env_var = serializers.CharField(read_only=True, allow_null=True)
    config_key = serializers.CharField(read_only=True, allow_null=True)
    source = serializers.CharField(read_only=True)
    accessed = serializers.DateTimeField(read_only=True)

    def to_representation(self, instance):
        """Return the configuration data as a dictionary."""
        if not isinstance(instance, str):
            instance = list(instance.keys())[0]
        return {'key': instance, **self.instance.get(instance)}


class NotesImageSerializer(InvenTreeModelSerializer):
    """Serializer for the NotesImage model."""

    class Meta:
        """Meta options for NotesImageSerializer."""

        model = common_models.NotesImage
        fields = ['pk', 'image', 'user', 'date', 'model_type', 'model_id']

        read_only_fields = ['date', 'user']

    image = InvenTreeImageSerializerField(required=True)


@register_importer()
class ProjectCodeSerializer(DataImportExportSerializerMixin, InvenTreeModelSerializer):
    """Serializer for the ProjectCode model."""

    class Meta:
        """Meta options for ProjectCodeSerializer."""

        model = common_models.ProjectCode
        fields = ['pk', 'code', 'description', 'responsible', 'responsible_detail']

    responsible_detail = OwnerSerializer(
        source='responsible', read_only=True, allow_null=True
    )


class WorkPlanSerializer(InvenTreeModelSerializer):
    """Serializer for project work plans and their aggregate progress."""

    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    created_by_detail = UserSerializer(source='created_by', read_only=True)
    manager_detail = UserSerializer(source='manager', read_only=True)
    project_code_detail = ProjectCodeSerializer(source='project_code', read_only=True)
    code = serializers.CharField(read_only=True)
    ticket_count = serializers.IntegerField(read_only=True, default=0)
    completed_ticket_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = common_models.WorkPlan
        fields = [
            'pk', 'code', 'name', 'description', 'project_code',
            'project_code_detail', 'manager', 'manager_detail', 'created_by',
            'created_by_detail', 'status', 'priority', 'start_date', 'target_date',
            'ticket_count', 'completed_ticket_count', 'created', 'updated',
        ]
        read_only_fields = [
            'code', 'ticket_count', 'completed_ticket_count', 'created', 'updated'
        ]

    @staticmethod
    def annotate_queryset(queryset):
        """Add ticket totals required by plan overview screens."""
        return queryset.annotate(
            ticket_count=Count('tickets', distinct=True),
            completed_ticket_count=Count(
                'tickets',
                filter=Q(tickets__status=common_models.WorkTicket.Status.DONE),
                distinct=True,
            ),
        )

    def validate(self, attrs):
        """Only the creator or plan manager can change a plan."""
        attrs = super().validate(attrs)
        request = self.context.get('request')
        if (
            self.instance
            and request
            and not request.user.is_staff
            and request.user.pk not in {
                self.instance.created_by_id,
                self.instance.manager_id,
            }
        ):
            raise PermissionDenied(_('Only the plan creator or manager can edit this plan'))

        start_date = attrs.get(
            'start_date', getattr(self.instance, 'start_date', None)
        )
        target_date = attrs.get(
            'target_date', getattr(self.instance, 'target_date', None)
        )
        if start_date and target_date and target_date < start_date:
            raise serializers.ValidationError({
                'target_date': _(
                    'Target completion date must not be before start date'
                )
            })

        project_code = attrs.get(
            'project_code', getattr(self.instance, 'project_code', None)
        )
        if (
            self.instance
            and project_code
            and project_code.pk != self.instance.project_code_id
            and self.instance.tickets.exists()
        ):
            raise serializers.ValidationError({
                'project_code': _('Project code cannot be changed after tasks are added')
            })

        status = attrs.get('status', getattr(self.instance, 'status', None))
        if (
            self.instance
            and status == common_models.WorkPlan.Status.DONE
            and self.instance.tickets.exclude(
                status=common_models.WorkTicket.Status.DONE
            ).exists()
        ):
            raise serializers.ValidationError({
                'status': _('All work tickets must be completed before closing the plan')
            })
        return attrs


class WorkTicketReferenceSerializer(InvenTreeModelSerializer):
    """Compact work-ticket representation for hierarchy fields."""

    class Meta:
        model = common_models.WorkTicket
        fields = ['pk', 'code', 'title', 'status']


class WorkTicketSerializer(InvenTreeModelSerializer):
    """Serializer enforcing the manager-assignee work ticket workflow."""

    MANY_TO_MANY_FIELDS = ('dependencies',)

    assigned_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    assigned_by_detail = UserSerializer(source='assigned_by', read_only=True)
    assigned_to_detail = UserSerializer(source='assigned_to', read_only=True)
    plan_detail = WorkPlanSerializer(source='plan', read_only=True)
    project_code_detail = ProjectCodeSerializer(
        source='project_code', read_only=True
    )
    parent_detail = WorkTicketReferenceSerializer(source='parent', read_only=True)
    dependency_details = WorkTicketReferenceSerializer(
        source='dependencies', many=True, read_only=True
    )
    open_subtask_count = serializers.IntegerField(read_only=True, default=0)
    code = serializers.CharField(read_only=True)

    class Meta:
        model = common_models.WorkTicket
        fields = [
            'pk', 'code', 'title', 'description', 'notes', 'plan', 'plan_detail',
            'project_code', 'project_code_detail', 'parent', 'parent_detail', 'dependencies',
            'dependency_details', 'assigned_to', 'assigned_to_detail',
            'assigned_by', 'assigned_by_detail', 'status', 'priority',
            'start_date', 'target_date', 'completion_date', 'estimated_hours',
            'actual_hours', 'overdue', 'created', 'updated',
            'open_subtask_count',
        ]
        read_only_fields = ['code', 'completion_date', 'overdue', 'created', 'updated']

    overdue = serializers.BooleanField(read_only=True, default=False)

    def skip_create_fields(self):
        """Skip many-to-many fields when building the validation model."""
        return [*super().skip_create_fields(), *self.MANY_TO_MANY_FIELDS]

    def run_validation(self, data=serializers.empty):
        """Validate many-to-many dependencies without direct model assignment."""
        if self.instance is None or data in [serializers.empty, None]:
            return super().run_validation(data)

        initial_data = data.copy()
        dependency_data = initial_data.pop('dependencies', serializers.empty)
        validated_data = super().run_validation(initial_data)

        if dependency_data is not serializers.empty:
            validated_data['dependencies'] = self.fields[
                'dependencies'
            ].run_validation(dependency_data)
            self._validate_dependencies(validated_data)

        return validated_data

    def create(self, validated_data):
        """Create a ticket and then apply its dependencies."""
        dependencies = validated_data.pop('dependencies', [])
        instance = super().create(validated_data)
        instance.dependencies.set(dependencies)
        return instance

    def update(self, instance, validated_data):
        """Update a ticket and explicitly apply dependency changes."""
        dependencies = validated_data.pop('dependencies', None)
        instance = super().update(instance, validated_data)
        if dependencies is not None:
            instance.dependencies.set(dependencies)
        return instance

    @staticmethod
    def annotate_queryset(queryset):
        return queryset.annotate(
            overdue=Case(
                When(common_models.WorkTicket.get_overdue_filter(), then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            ),
            open_subtask_count=Count(
                'subtasks',
                filter=~Q(subtasks__status=common_models.WorkTicket.Status.DONE),
                distinct=True,
            ),
        )

    def _validate_dependencies(self, attrs):
        """Ensure dependency links stay within the same plan and project."""
        dependencies = attrs.get('dependencies')
        if dependencies is None:
            return

        plan = attrs.get('plan', getattr(self.instance, 'plan', None))
        project_code = attrs.get(
            'project_code', getattr(self.instance, 'project_code', None)
        )

        for dependency in dependencies:
            if self.instance and dependency.pk == self.instance.pk:
                raise serializers.ValidationError({
                    'dependencies': _('A work ticket cannot depend on itself')
                })
            if project_code and dependency.project_code_id != project_code.pk:
                raise serializers.ValidationError({
                    'dependencies': _('Dependencies must use the same project code')
                })
            if dependency.plan_id != (plan.pk if plan else None):
                raise serializers.ValidationError({
                    'dependencies': _('Dependencies must belong to the same plan')
                })
            if self.instance:
                pending = [dependency]
                visited = set()
                while pending:
                    candidate = pending.pop()
                    if candidate.pk in visited:
                        continue
                    if candidate.pk == self.instance.pk:
                        raise serializers.ValidationError({
                            'dependencies': _(
                                'Dependency would create a circular relationship'
                            )
                        })
                    visited.add(candidate.pk)
                    pending.extend(candidate.dependencies.all())

    def validate(self, attrs):
        """Allow only the assignee and manager to advance their respective steps."""
        request = self.context.get('request')
        plan = attrs.get('plan', getattr(self.instance, 'plan', None))
        project_code = attrs.get(
            'project_code', getattr(self.instance, 'project_code', None)
        )
        if plan and project_code and plan.project_code_id != project_code.pk:
            raise serializers.ValidationError({
                'project_code': _('Work ticket must use the same project code as its plan')
            })
        start_date = attrs.get(
            'start_date', getattr(self.instance, 'start_date', None)
        )
        target_date = attrs.get(
            'target_date', getattr(self.instance, 'target_date', None)
        )
        if start_date and target_date and target_date < start_date:
            raise serializers.ValidationError({
                'target_date': _(
                    'Target completion date must not be before start date'
                )
            })

        parent = attrs.get('parent', getattr(self.instance, 'parent', None))
        if parent:
            if self.instance and parent.pk == self.instance.pk:
                raise serializers.ValidationError({
                    'parent': _('A work ticket cannot be its own parent')
                })
            if project_code and parent.project_code_id != project_code.pk:
                raise serializers.ValidationError({
                    'parent': _('Parent work ticket must use the same project code')
                })
            if parent.plan_id != (plan.pk if plan else None):
                raise serializers.ValidationError({
                    'parent': _('Parent work ticket must belong to the same plan')
                })

            ancestor = parent
            while ancestor:
                if self.instance and ancestor.pk == self.instance.pk:
                    raise serializers.ValidationError({
                        'parent': _('Parent work ticket would create a circular hierarchy')
                    })
                ancestor = ancestor.parent

        self._validate_dependencies(attrs)

        if not self.instance:
            return attrs

        non_status_fields = set(attrs) - {'status'}
        can_manage = bool(
            request
            and (
                request.user.is_staff
                or request.user.pk == self.instance.assigned_by_id
                or (
                    self.instance.plan_id
                    and request.user.pk
                    in {
                        self.instance.plan.manager_id,
                        self.instance.plan.created_by_id,
                    }
                )
            )
        )
        assignee_editable_fields = {'actual_hours', 'notes'}
        can_update_progress = bool(
            request
            and request.user.pk == self.instance.assigned_to_id
            and non_status_fields.issubset(assignee_editable_fields)
        )
        if non_status_fields and not can_manage and not can_update_progress:
            raise PermissionDenied(_('Only the assigning manager can edit this ticket'))

        if 'status' not in attrs or attrs['status'] == self.instance.status:
            return attrs

        current, target = self.instance.status, attrs['status']
        if self.instance.plan_id and self.instance.plan.status in {
            common_models.WorkPlan.Status.ON_HOLD,
            common_models.WorkPlan.Status.DONE,
            common_models.WorkPlan.Status.CANCELLED,
        }:
            raise serializers.ValidationError({
                'status': _('Work status cannot be changed while the plan is inactive')
            })

        if target == common_models.WorkTicket.Status.PROCESSING:
            dependencies = attrs.get('dependencies')
            if dependencies is None:
                dependencies = self.instance.dependencies.all()
            if any(
                dependency.status != common_models.WorkTicket.Status.DONE
                for dependency in dependencies
            ):
                raise serializers.ValidationError({
                    'status': _('Complete all dependencies before starting this work ticket')
                })

        if (
            target == common_models.WorkTicket.Status.DONE
            and self.instance.subtasks.exclude(
                status=common_models.WorkTicket.Status.DONE
            ).exists()
        ):
            raise serializers.ValidationError({
                'status': _('Complete all subtasks before completing this work ticket')
            })

        assignee_transition = (current, target) in {
            (common_models.WorkTicket.Status.OPEN, common_models.WorkTicket.Status.PROCESSING),
            (common_models.WorkTicket.Status.PROCESSING, common_models.WorkTicket.Status.REVIEW),
        }
        manager_transition = (current, target) == (
            common_models.WorkTicket.Status.REVIEW,
            common_models.WorkTicket.Status.DONE,
        )

        if assignee_transition and request and (
            request.user.is_staff
            or request.user.pk == self.instance.assigned_to_id
        ):
            return attrs
        if manager_transition and request and (
            request.user.is_staff
            or request.user.pk == self.instance.assigned_by_id
            or (
                self.instance.plan_id
                and request.user.pk
                in {
                    self.instance.plan.manager_id,
                    self.instance.plan.created_by_id,
                }
            )
        ):
            attrs['completion_date'] = now()
            return attrs
        raise PermissionDenied(_('Bạn không có quyền chuyển trạng thái công việc.'))


@register_importer()
class CustomStateSerializer(DataImportExportSerializerMixin, InvenTreeModelSerializer):
    """Serializer for the custom state model."""

    class Meta:
        """Meta options for CustomStateSerializer."""

        model = common_models.InvenTreeCustomUserStateModel
        fields = [
            'pk',
            'key',
            'name',
            'label',
            'color',
            'logical_key',
            'model',
            'model_name',
            'reference_status',
        ]

    model_name = serializers.CharField(read_only=True, source='model.name')

    reference_status = serializers.ChoiceField(
        choices=generic.states.custom.state_reference_mappings()
    )


class FlagSerializer(serializers.Serializer):
    """Serializer for feature flags."""

    key = serializers.CharField(read_only=True)
    state = serializers.CharField(read_only=True)
    conditions = serializers.ListField(
        child=serializers.DictField(), read_only=True, allow_null=True
    )

    def to_representation(self, instance):
        """Return the configuration data as a dictionary."""
        request = self.context.get('request')
        if not isinstance(instance, str):
            instance = list(instance.keys())[0]
        data = {'key': instance, 'state': flag_state(instance, request=request)}

        if request and request.user.is_superuser:
            data['conditions'] = self.instance.get(instance)

        return data


class ContentTypeSerializer(serializers.Serializer):
    """Serializer for ContentType models."""

    pk = serializers.IntegerField(read_only=True)
    app_label = serializers.CharField(read_only=True)
    model = serializers.CharField(read_only=True)
    app_labeled_name = serializers.CharField(read_only=True)
    is_plugin = serializers.SerializerMethodField('get_is_plugin', read_only=True)

    class Meta:
        """Meta options for ContentTypeSerializer."""

        model = ContentType
        fields = ['pk', 'app_label', 'model', 'app_labeled_name', 'is_plugin']

    def get_is_plugin(self, obj) -> bool:
        """Return True if the model is a plugin model."""
        return obj.app_label in plugin_registry.installed_apps


@register_importer()
class CustomUnitSerializer(DataImportExportSerializerMixin, InvenTreeModelSerializer):
    """DRF serializer for CustomUnit model."""

    class Meta:
        """Meta options for CustomUnitSerializer."""

        model = common_models.CustomUnit
        fields = ['pk', 'name', 'symbol', 'definition']


class AllUnitListResponseSerializer(serializers.Serializer):
    """Serializer for the AllUnitList."""

    class Unit(serializers.Serializer):
        """Serializer for the AllUnitListResponseSerializer."""

        name = serializers.CharField()
        is_alias = serializers.BooleanField()
        compatible_units = serializers.ListField(child=serializers.CharField())
        isdimensionless = serializers.BooleanField()

    default_system = serializers.CharField()
    available_systems = serializers.ListField(child=serializers.CharField())
    available_units = serializers.DictField(child=Unit())


class ErrorMessageSerializer(InvenTreeModelSerializer):
    """DRF serializer for server error messages."""

    class Meta:
        """Metaclass options for ErrorMessageSerializer."""

        model = Error

        fields = ['when', 'info', 'data', 'path', 'pk']

        read_only_fields = ['when', 'info', 'data', 'path', 'pk']


class TaskDetailSerializer(serializers.Serializer):
    """Serializer for a background task detail."""

    task_id = serializers.CharField(read_only=True)
    exists = serializers.BooleanField(read_only=True)
    pending = serializers.BooleanField(read_only=True)
    complete = serializers.BooleanField(read_only=True)
    success = serializers.BooleanField(read_only=True)
    http_status = serializers.IntegerField(read_only=True)

    @classmethod
    def from_task(cls, task_id: str | bool | None) -> 'TaskDetailSerializer':
        """Create a TaskDetailSerializer instance from a django_q Task.

        Arguments:
            task_id: The ID of the task to retrieve details for.

        Returns:
            An instance of TaskDetailSerializer with the task details.

        Notes:
            - If the provided task_id is None, the task has not been run, or has errored out
            - If the provided task_id is a boolean, the task has been run synchronously, and the boolean value indicates success or failure
            - If the provided task_id is a string, the task has been offloaded to the background worker, and the details can be from the database

        """
        from InvenTree.tasks import get_queued_task

        if task_id is None or type(task_id) is bool:
            # If the task_id is a boolean, the task has been run synchronously
            return cls({
                'task_id': '',
                'exists': False,
                'pending': False,
                'complete': task_id is not None,
                'success': False if task_id is None else bool(task_id),
                'http_status': 404 if task_id is None else 200,
            })

        # A non-boolean result indicates that the task has been offloaded to the background worker
        success = django_q.models.Success.objects.filter(id=task_id).first()
        failure = django_q.models.Failure.objects.filter(id=task_id).first()
        task = (
            success
            or failure
            or django_q.models.Task.objects.filter(id=task_id).first()
        )
        queued = False

        exists = bool(success or failure or task)

        if not exists:
            # If the task has not been started yet, it may be present in the queue
            queued = bool(get_queued_task(task_id))

        complete = bool(success) or bool(failure)

        # Determine the http_status code for the task
        # - 200: Task exists and has been completed
        # - 404: Task does not exist
        http_status = 200 if exists or queued else 404

        return cls({
            'task_id': task_id,
            'exists': exists or queued,
            'pending': queued,
            'complete': complete,
            'success': bool(success),
            'http_status': http_status,
        })


class TaskOverviewSerializer(serializers.Serializer):
    """Serializer for background task overview."""

    is_running = serializers.BooleanField(
        label=_('Is Running'),
        help_text='Boolean value to indicate if the background worker process is running.',
        read_only=True,
    )

    pending_tasks = serializers.IntegerField(
        label=_('Pending Tasks'),
        help_text='Number of active background tasks',
        read_only=True,
    )

    scheduled_tasks = serializers.IntegerField(
        label=_('Scheduled Tasks'),
        help_text='Number of scheduled background tasks',
        read_only=True,
    )

    failed_tasks = serializers.IntegerField(
        label=_('Failed Tasks'),
        help_text='Number of failed background tasks',
        read_only=True,
    )


class PendingTaskSerializer(InvenTreeModelSerializer):
    """Serializer for an individual pending task object."""

    class Meta:
        """Metaclass options for the serializer."""

        model = django_q.models.OrmQ
        fields = ['pk', 'key', 'lock', 'task_id', 'name', 'func', 'args', 'kwargs']

    task_id = serializers.CharField(label=_('Task ID'), help_text=_('Unique task ID'))

    lock = serializers.DateTimeField(label=_('Lock'), help_text=_('Lock time'))

    name = serializers.CharField(label=_('Name'), help_text=_('Task name'))

    func = serializers.CharField(label=_('Function'), help_text=_('Function name'))

    args = serializers.CharField(label=_('Arguments'), help_text=_('Task arguments'))

    kwargs = serializers.CharField(
        label=_('Keyword Arguments'), help_text=_('Task keyword arguments')
    )


class ScheduledTaskSerializer(InvenTreeModelSerializer):
    """Serializer for an individual scheduled task object."""

    class Meta:
        """Metaclass options for the serializer."""

        model = django_q.models.Schedule
        fields = [
            'pk',
            'name',
            'func',
            'args',
            'kwargs',
            'schedule_type',
            'repeats',
            'last_run',
            'next_run',
            'success',
            'task',
        ]

    last_run = serializers.DateTimeField()
    success = serializers.BooleanField()

    @staticmethod
    def annotate_queryset(queryset):
        """Add custom annotations to the queryset.

        - last_run: The last time the task was run
        - success: The outcome status of the last run
        """
        task = django_q.models.Task.objects.filter(id=OuterRef('task'))

        queryset = queryset.annotate(
            last_run=Subquery(task.values('started')[:1]),
            success=Subquery(task.values('success')[:1]),
        )

        return queryset


class FailedTaskSerializer(InvenTreeModelSerializer):
    """Serializer for an individual failed task object."""

    class Meta:
        """Metaclass options for the serializer."""

        model = django_q.models.Failure
        fields = [
            'pk',
            'name',
            'func',
            'args',
            'kwargs',
            'started',
            'stopped',
            'attempt_count',
            'result',
        ]

    pk = serializers.CharField(source='id', read_only=True)

    result = serializers.CharField()


class AttachmentSerializer(FilterableSerializerMixin, InvenTreeModelSerializer):
    """Serializer class for the Attachment model."""

    class Meta:
        """Serializer metaclass."""

        model = common_models.Attachment
        fields = [
            'pk',
            'attachment',
            'filename',
            'link',
            'comment',
            'upload_date',
            'upload_user',
            'user_detail',
            'file_size',
            'model_type',
            'model_id',
            'tags',
        ]

        read_only_fields = ['pk', 'file_size', 'upload_date', 'upload_user', 'filename']

    def __init__(self, *args, **kwargs):
        """Override the model_type field to provide dynamic choices."""
        super().__init__(*args, **kwargs)

        if len(self.fields['model_type'].choices) == 0:
            self.fields[
                'model_type'
            ].choices = common.validators.attachment_model_options()

    tags = common.filters.enable_tags_filter()

    user_detail = UserSerializer(source='upload_user', read_only=True, many=False)

    attachment = InvenTreeAttachmentSerializerField(required=False, allow_null=True)

    # The 'filename' field must be present in the serializer
    filename = serializers.CharField(
        label=_('Filename'), required=False, source='basename', allow_blank=False
    )

    upload_date = serializers.DateField(read_only=True)

    # Note: The choices are overridden at run-time on class initialization
    model_type = serializers.ChoiceField(
        label=_('Model Type'),
        choices=common.validators.attachment_model_options(),
        required=True,
        allow_blank=False,
        allow_null=False,
    )

    def save(self, **kwargs):
        """Override the save method to handle the model_type field."""
        from InvenTree.models import InvenTreeAttachmentMixin
        from users.permissions import check_user_permission

        model_type = self.validated_data.get('model_type', None)

        if model_type is None and self.instance:
            model_type = self.instance.model_type

        # Ensure that the user has permission to attach files to the specified model
        user = self.context.get('request').user

        target_model_class = common.validators.attachment_model_class_from_label(
            model_type
        )

        if not issubclass(target_model_class, InvenTreeAttachmentMixin):
            raise PermissionDenied(_('Invalid model type specified for attachment'))

        permission_error_msg = _(
            'User does not have permission to create or edit attachments for this model'
        )

        if not check_user_permission(user, target_model_class, 'change'):
            raise PermissionDenied(permission_error_msg)

        # Check that the user has the required permissions to attach files to the target model
        if not target_model_class.check_related_permission('change', user):
            raise PermissionDenied(permission_error_msg)

        return super().save(**kwargs)


@register_importer()
class ParameterTemplateSerializer(
    DataImportExportSerializerMixin, InvenTreeModelSerializer
):
    """Serializer for the ParameterTemplate model."""

    class Meta:
        """Meta options for ParameterTemplateSerializer."""

        model = common_models.ParameterTemplate
        fields = [
            'pk',
            'name',
            'units',
            'description',
            'model_type',
            'checkbox',
            'choices',
            'selectionlist',
            'enabled',
        ]

    # Note: The choices are overridden at run-time on class initialization
    model_type = ContentTypeField(
        mixin_class=InvenTreeParameterMixin,
        choices=common.validators.parameter_template_model_options,
        label=_('Model Type'),
        default='',
        required=False,
        allow_null=True,
    )

    def validate_model_type(self, model_type):
        """Convert an empty string to None for the model_type field."""
        return model_type or None


@register_importer()
class ParameterSerializer(
    FilterableSerializerMixin, DataImportExportSerializerMixin, InvenTreeModelSerializer
):
    """Serializer for the Parameter model."""

    class Meta:
        """Meta options for ParameterSerializer."""

        model = common_models.Parameter
        fields = [
            'pk',
            'template',
            'model_type',
            'model_id',
            'data',
            'data_numeric',
            'note',
            'updated',
            'updated_by',
            # Optional fields
            'template_detail',
            'updated_by_detail',
        ]

        read_only_fields = ['updated', 'updated_by']

    def save(self, **kwargs):
        """Save the Parameter instance."""
        from InvenTree.models import InvenTreeParameterMixin
        from users.permissions import check_user_permission

        model_type = self.validated_data.get('model_type', None)

        if model_type is None and self.instance:
            model_type = self.instance.model_type

        # Ensure that the user has permission to modify parameters for the specified model
        user = self.context.get('request').user

        target_model_class = model_type.model_class()

        if not issubclass(target_model_class, InvenTreeParameterMixin):
            raise PermissionDenied(_('Invalid model type specified for parameter'))

        permission_error_msg = _(
            'User does not have permission to create or edit parameters for this model'
        )

        if not check_user_permission(user, target_model_class, 'change'):
            raise PermissionDenied(permission_error_msg)

        if not target_model_class.check_related_permission('change', user):
            raise PermissionDenied(permission_error_msg)

        instance = super().save(**kwargs)
        instance.updated_by = user
        instance.save()

        return instance

    # Note: The choices are overridden at run-time on class initialization
    model_type = ContentTypeField(
        mixin_class=InvenTreeParameterMixin,
        choices=common.validators.parameter_model_options,
        label=_('Model Type'),
        default='',
        allow_null=False,
    )

    updated_by_detail = OptionalField(
        serializer_class=UserSerializer,
        serializer_kwargs={
            'source': 'updated_by',
            'read_only': True,
            'allow_null': True,
            'many': False,
        },
        default_include=True,
        prefetch_fields=['updated_by'],
    )

    template_detail = OptionalField(
        serializer_class=ParameterTemplateSerializer,
        serializer_kwargs={'source': 'template', 'read_only': True, 'many': False},
        default_include=True,
        prefetch_fields=['template', 'template__model_type'],
    )


class IconSerializer(serializers.Serializer):
    """Serializer for an icon."""

    name = serializers.CharField()
    category = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField())
    variants = serializers.DictField(child=serializers.CharField())


class IconPackageSerializer(serializers.Serializer):
    """Serializer for a list of icons."""

    name = serializers.CharField()
    prefix = serializers.CharField()
    fonts = serializers.DictField(child=serializers.CharField())
    icons = serializers.DictField(child=IconSerializer())


class SelectionEntrySerializer(InvenTreeModelSerializer):
    """Serializer for a selection entry."""

    class Meta:
        """Meta options for SelectionEntrySerializer."""

        model = common_models.SelectionListEntry
        fields = '__all__'

    def validate(self, attrs):
        """Ensure that the selection list is not locked."""
        ret = super().validate(attrs)
        if self.instance and self.instance.list.locked:
            raise serializers.ValidationError({'list': _('Selection list is locked')})
        return ret


class SelectionListSerializer(InvenTreeModelSerializer):
    """Serializer for a selection list."""

    _choices_validated: dict = {}

    class Meta:
        """Meta options for SelectionListSerializer."""

        model = common_models.SelectionList
        fields = [
            'pk',
            'name',
            'description',
            'active',
            'locked',
            'source_plugin',
            'source_string',
            'default',
            'created',
            'last_updated',
            'choices',
            'entry_count',
        ]

    default = SelectionEntrySerializer(read_only=True, many=False)
    choices = SelectionEntrySerializer(source='entries', many=True, required=False)
    entry_count = serializers.IntegerField(read_only=True)

    @staticmethod
    def annotate_queryset(queryset):
        """Add count of entries for each selection list."""
        return queryset.annotate(entry_count=Count('entries'))

    def is_valid(self, *, raise_exception=False):
        """Validate the selection list. Choices are validated separately."""
        choices = (
            self.initial_data.pop('choices')
            if self.initial_data.get('choices') is not None
            else []
        )

        # Validate the choices
        _choices_validated = []
        db_entries = (
            {a.id: a for a in self.instance.entries.all()} if self.instance else {}
        )

        for choice in choices:
            current_inst = db_entries.get(choice.get('id'))
            serializer = SelectionEntrySerializer(
                instance=current_inst,
                data={'list': current_inst.list.pk if current_inst else None, **choice},
            )
            serializer.is_valid(raise_exception=raise_exception)
            _choices_validated.append({
                **serializer.validated_data,
                'id': choice.get('id'),
            })
        self._choices_validated = _choices_validated

        return super().is_valid(raise_exception=raise_exception)

    def create(self, validated_data):
        """Create a new selection list. Save the choices separately."""
        list_entry = common_models.SelectionList.objects.create(**validated_data)
        for choice_data in self._choices_validated:
            common_models.SelectionListEntry.objects.create(**{
                **choice_data,
                'list': list_entry,
            })
        return list_entry

    def update(self, instance, validated_data):
        """Update an existing selection list. Save the choices separately."""
        inst_mapping = {inst.id: inst for inst in instance.entries.all()}
        existing_ids = {a.get('id') for a in self._choices_validated}

        # Perform creations and updates.
        ret = []
        for data in self._choices_validated:
            list_inst = data.get('list', None)
            inst = inst_mapping.get(data.get('id'))
            if inst is None:
                if list_inst is None:
                    data['list'] = instance
                ret.append(SelectionEntrySerializer().create(data))
            else:
                ret.append(SelectionEntrySerializer().update(inst, data))

        # Perform deletions.
        for entry_id in inst_mapping.keys() - existing_ids:
            inst_mapping[entry_id].delete()

        return super().update(instance, validated_data)

    def validate(self, attrs):
        """Ensure that the selection list is not locked."""
        ret = super().validate(attrs)
        if self.instance and self.instance.locked:
            raise serializers.ValidationError({'locked': _('Selection list is locked')})
        return ret


class DataOutputSerializer(InvenTreeModelSerializer):
    """Serializer for the DataOutput model."""

    class Meta:
        """Meta options for DataOutputSerializer."""

        model = common_models.DataOutput
        fields = [
            'pk',
            'created',
            'user',
            'user_detail',
            'total',
            'progress',
            'complete',
            'output_type',
            'template_name',
            'plugin',
            'output',
            'errors',
        ]

    user_detail = UserSerializer(source='user', read_only=True, many=False)

    output = InvenTreeAttachmentSerializerField(allow_null=True, read_only=True)


class EmailMessageSerializer(InvenTreeModelSerializer):
    """Serializer for the EmailMessage model."""

    class Meta:
        """Meta options for EmailMessageSerializer."""

        model = common_models.EmailMessage
        fields = [
            'pk',
            'global_id',
            'message_id_key',
            'thread_id_key',
            'thread',
            'subject',
            'body',
            'to',
            'sender',
            'status',
            'timestamp',
            'headers',
            'full_message',
            'direction',
            'priority',
            'error_code',
            'error_message',
            'error_timestamp',
            'delivery_options',
        ]


class TestEmailSerializer(serializers.Serializer):
    """Serializer to send a test email."""

    class Meta:
        """Meta options for TestEmailSerializer."""

        fields = ['email']

    email = serializers.EmailField(required=True)
