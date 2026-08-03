"""JSON serializers for the Order API."""

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models, transaction
from django.db.models import BooleanField, Case, ExpressionWrapper, F, Q, Value, When
from django.db.models.functions import Coalesce, Greatest
from django.utils.translation import gettext_lazy as _

from rest_framework import serializers
from rest_framework.serializers import ValidationError
from sql_util.utils import SubqueryCount, SubquerySum

import build.models as build_models
import build.serializers
import common.filters
import common.serializers
import common.settings
import company.models as company_models
import order.models
import part.filters as part_filters
import stock.models
import stock.serializers
from company.serializers import (
    AddressBriefSerializer,
    CompanyBriefSerializer,
    ContactSerializer,
    SupplierPartSerializer,
)
from generic.states.fields import InvenTreeCustomStatusSerializerMixin
from importer.registry import register_importer
from InvenTree.helpers import extract_serial_numbers, hash_barcode, normalize, str2bool
from InvenTree.mixins import DataImportExportSerializerMixin
from InvenTree.serializers import (
    FilterableSerializerMixin,
    InvenTreeCurrencySerializer,
    InvenTreeDecimalField,
    InvenTreeModelSerializer,
    InvenTreeMoneySerializer,
    NotesFieldMixin,
    OptionalField,
)
from order.status_codes import (
    PurchaseOrderStatusGroups,
    ReturnOrderLineStatus,
    ReturnOrderStatus,
    SalesOrderStatus,
    SalesOrderStatusGroups,
)
from part.serializers import PartBriefSerializer
from stock.status_codes import StockStatus
from users.serializers import OwnerSerializer, UserSerializer


class ContractBriefSerializer(InvenTreeModelSerializer):
    """Brief serializer for linked Contract objects."""

    project_code_detail = common.serializers.ProjectCodeSerializer(
        source='project_code', read_only=True, allow_null=True
    )

    class Meta:
        """Metaclass options."""

        model = order.models.Contract
        fields = [
            'pk',
            'reference',
            'contract_type',
            'title',
            'project_code',
            'work_ticket',
            'project_code_detail',
            'buyer',
            'seller',
            'party_a_contact',
            'party_b_contact',
            'party_a_name',
            'party_a_representative',
            'party_b_name',
            'party_b_representative',
            'issue_date',
            'effective_date',
            'grand_total',
        ]


@register_importer()
class ContractSerializer(
    DataImportExportSerializerMixin,
    FilterableSerializerMixin,
    InvenTreeModelSerializer,
):
    """Serializer for the Contract model class."""

    CONTRACT_ORDER_FIELDS = ('sales_orders', 'purchase_orders')

    project_code_label = common.filters.enable_project_label_filter()
    project_code_detail = common.filters.enable_project_code_filter()

    sales_contract_detail = OptionalField(
        serializer_class=ContractBriefSerializer,
        serializer_kwargs={
            'source': 'sales_contract',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['sales_contract'],
    )

    sales_order_count = serializers.IntegerField(read_only=True)
    purchase_order_count = serializers.IntegerField(read_only=True)
    purchase_contract_count = serializers.IntegerField(read_only=True)

    buyer_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={'source': 'buyer', 'many': False, 'read_only': True, 'allow_null': True},
        default_include=True,
        prefetch_fields=['buyer'],
    )

    seller_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={'source': 'seller', 'many': False, 'read_only': True, 'allow_null': True},
        default_include=True,
        prefetch_fields=['seller'],
    )

    party_a_contact_detail = OptionalField(
        serializer_class=ContactSerializer,
        serializer_kwargs={
            'source': 'party_a_contact',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['party_a_contact'],
    )

    party_b_contact_detail = OptionalField(
        serializer_class=ContactSerializer,
        serializer_kwargs={
            'source': 'party_b_contact',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['party_b_contact'],
    )

    class Meta:
        """Metaclass options."""

        model = order.models.Contract
        fields = [
            'pk',
            'reference',
            'contract_type',
            'title',
            'project_code',
            'work_ticket',
            'project_code_detail',
            'project_code_label',
            'buyer',
            'buyer_detail',
            'seller',
            'seller_detail',
            'party_a_contact',
            'party_a_contact_detail',
            'party_b_contact',
            'party_b_contact_detail',
            'sales_contract',
            'sales_contract_detail',
            'sales_orders',
            'purchase_orders',
            'sales_order_count',
            'purchase_order_count',
            'purchase_contract_count',
            'party_a_name',
            'party_a_representative',
            'party_b_name',
            'party_b_representative',
            'issue_date',
            'effective_date',
            'work_scope',
            'delivery_terms',
            'payment_terms',
            'warranty_terms',
            'total_amount',
            'vat_rate',
            'vat_amount',
            'grand_total',
            'amount_text',
            'notes',
            'creation_date',
            'created_by',
            'updated_at',
        ]
        read_only_fields = [
            'creation_date',
            'updated_at',
            'sales_order_count',
            'purchase_order_count',
            'purchase_contract_count',
        ]

    @staticmethod
    def annotate_queryset(queryset):
        """Add contract relationship counts to the queryset."""
        return queryset.annotate(
            sales_order_count=SubqueryCount('sales_orders'),
            purchase_order_count=SubqueryCount('purchase_orders'),
            purchase_contract_count=SubqueryCount('purchase_contracts'),
        )

    def skip_create_fields(self):
        """Skip many-to-many fields when building the validation model."""
        return [*super().skip_create_fields(), *self.CONTRACT_ORDER_FIELDS]

    def run_validation(self, data=serializers.empty):
        """Validate many-to-many order links without assigning them directly."""
        if self.instance is None or data in [serializers.empty, None]:
            return super().run_validation(data)

        initial_data = data.copy()
        order_data = {}

        for field in self.CONTRACT_ORDER_FIELDS:
            if field in initial_data:
                order_data[field] = initial_data.pop(field)

        validated_data = super().run_validation(initial_data)

        for field, value in order_data.items():
            validated_data[field] = self.fields[field].run_validation(value)

        self.validate_order_links(validated_data)

        return validated_data

    def validate_order_links(self, data):
        """Validate linked order relationships."""
        contract_type = data.get(
            'contract_type', getattr(self.instance, 'contract_type', None)
        )
        sales_orders = data.get('sales_orders')
        purchase_orders = data.get('purchase_orders')

        if contract_type == order.models.Contract.ContractType.SALES and purchase_orders:
            raise ValidationError({
                'purchase_orders': _('Sales contracts can only link to sales orders')
            })

        if contract_type == order.models.Contract.ContractType.PURCHASE and sales_orders:
            raise ValidationError({
                'sales_orders': _('Purchase contracts can only link to purchase orders')
            })

        project_code = data.get(
            'project_code', getattr(self.instance, 'project_code', None)
        )

        if project_code:
            for sales_order in sales_orders or []:
                if (
                    sales_order.project_code_id
                    and sales_order.project_code_id != project_code.pk
                ):
                    raise ValidationError({
                        'sales_orders': _(
                            'Linked sales orders must use the same project code'
                        )
                    })

            for purchase_order in purchase_orders or []:
                if (
                    purchase_order.project_code_id
                    and purchase_order.project_code_id != project_code.pk
                ):
                    raise ValidationError({
                        'purchase_orders': _(
                            'Linked purchase orders must use the same project code'
                        )
                    })

    def pop_order_links(self, validated_data):
        """Remove many-to-many order links for explicit post-save handling."""
        return {
            field: validated_data.pop(field)
            for field in self.CONTRACT_ORDER_FIELDS
            if field in validated_data
        }

    def set_order_links(self, instance, order_links):
        """Apply many-to-many order links after the contract has been saved."""
        for field, values in order_links.items():
            getattr(instance, field).set(values)

    @transaction.atomic
    def create(self, validated_data):
        """Create a contract and then apply linked orders."""
        order_links = self.pop_order_links(validated_data)
        instance = super().create(validated_data)
        self.set_order_links(instance, order_links)

        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        """Update a contract and then apply linked orders."""
        order_links = self.pop_order_links(validated_data)
        instance = super().update(instance, validated_data)
        self.set_order_links(instance, order_links)

        return instance

    def validate(self, data):
        """Validate contract order relationships and derived values."""
        data = super().validate(data)

        work_ticket = data.get('work_ticket', getattr(self.instance, 'work_ticket', None))
        request = self.context.get('request')
        if work_ticket:
            allowed_users = {
                work_ticket.assigned_to_id,
                work_ticket.assigned_by_id,
            }
            if work_ticket.plan_id:
                allowed_users.update({
                    work_ticket.plan.manager_id,
                    work_ticket.plan.created_by_id,
                })
            if (
                request
                and not request.user.is_staff
                and request.user.pk not in allowed_users
            ):
                raise ValidationError({
                    'work_ticket': _('Only the ticket assignee or assigner can create linked records')
                })
            data['project_code'] = work_ticket.project_code

        contract_type = data.get(
            'contract_type', getattr(self.instance, 'contract_type', None)
        )
        issue_date = data.get('issue_date', getattr(self.instance, 'issue_date', None))
        effective_date = data.get(
            'effective_date', getattr(self.instance, 'effective_date', None)
        )

        if issue_date and effective_date and effective_date <= issue_date:
            raise ValidationError({
                'effective_date': _('Ngày hiệu lực phải sau ngày ký hợp đồng')
            })

        if contract_type == order.models.Contract.ContractType.SALES and data.get(
            'sales_contract'
        ):
            raise ValidationError({
                'sales_contract': _('Sales contracts cannot link to another sales contract')
            })

        if contract_type == order.models.Contract.ContractType.PURCHASE:
            sales_contract = data.get(
                'sales_contract', getattr(self.instance, 'sales_contract', None)
            )
            if sales_contract and sales_contract.contract_type != order.models.Contract.ContractType.SALES:
                raise ValidationError({
                    'sales_contract': _('Linked sales contract must be a sales contract')
                })
            if sales_contract:
                data['project_code'] = sales_contract.project_code

        buyer = data.get('buyer', getattr(self.instance, 'buyer', None))
        seller = data.get('seller', getattr(self.instance, 'seller', None))

        if contract_type == order.models.Contract.ContractType.SALES:
            if buyer and not buyer.is_customer:
                raise ValidationError({'buyer': _('Sales contract buyer must be a customer')})
            if seller and not seller.is_internal:
                raise ValidationError({'seller': _('Sales contract seller must be an internal company')})

        if contract_type == order.models.Contract.ContractType.PURCHASE:
            if buyer and not buyer.is_internal:
                raise ValidationError({'buyer': _('Purchase contract buyer must be an internal company')})
            if seller and not seller.is_supplier:
                raise ValidationError({'seller': _('Purchase contract seller must be a supplier')})

        if buyer:
            data['party_b_name'] = buyer.name
            data['party_b_representative'] = buyer.representative

        if seller:
            data['party_a_name'] = seller.name
            data['party_a_representative'] = seller.representative

        party_a_contact = data.get(
            'party_a_contact', getattr(self.instance, 'party_a_contact', None)
        )
        party_b_contact = data.get(
            'party_b_contact', getattr(self.instance, 'party_b_contact', None)
        )

        if party_a_contact:
            if seller and party_a_contact.company_id != seller.pk:
                raise ValidationError({
                    'party_a_contact': _('Party A contact must belong to the seller')
                })
            data['party_a_representative'] = party_a_contact.name

        if party_b_contact:
            if buyer and party_b_contact.company_id != buyer.pk:
                raise ValidationError({
                    'party_b_contact': _('Party B contact must belong to the buyer')
                })
            data['party_b_representative'] = party_b_contact.name

        project_code = data.get(
            'project_code', getattr(self.instance, 'project_code', None)
        )

        if not project_code:
            raise ValidationError({'project_code': _('Project code is required')})

        self.validate_order_links(data)

        total_amount = data.get(
            'total_amount', getattr(self.instance, 'total_amount', Decimal(0))
        )
        vat_rate = data.get('vat_rate', getattr(self.instance, 'vat_rate', Decimal(0)))
        vat_amount = (total_amount * vat_rate / Decimal(100)).quantize(
            Decimal('0.0001')
        )

        data['vat_amount'] = vat_amount
        data['grand_total'] = (total_amount + vat_amount).quantize(Decimal('0.0001'))

        return data


class TotalPriceMixin(serializers.Serializer):
    """Serializer mixin which provides total price fields."""

    total_price = InvenTreeMoneySerializer(allow_null=True, read_only=True)

    order_currency = InvenTreeCurrencySerializer(
        allow_blank=True,
        allow_null=True,
        required=False,
        label=_('Order Currency'),
        help_text=_('Currency for this order (leave blank to use company default)'),
    )


class DuplicateOrderSerializer(serializers.Serializer):
    """Serializer for specifying options when duplicating an order."""

    class Meta:
        """Metaclass options."""

        fields = ['order_id', 'copy_lines', 'copy_extra_lines', 'copy_parameters']

    order_id = serializers.IntegerField(
        required=True, label=_('Order ID'), help_text=_('ID of the order to duplicate')
    )

    copy_lines = serializers.BooleanField(
        required=False,
        default=True,
        label=_('Copy Lines'),
        help_text=_('Copy line items from the original order'),
    )

    copy_extra_lines = serializers.BooleanField(
        required=False,
        default=True,
        label=_('Copy Extra Lines'),
        help_text=_('Copy extra line items from the original order'),
    )

    copy_parameters = serializers.BooleanField(
        required=False,
        default=True,
        label=_('Copy Parameters'),
        help_text=_('Copy order parameters from the original order'),
    )


class AbstractOrderSerializer(
    DataImportExportSerializerMixin, FilterableSerializerMixin, serializers.Serializer
):
    """Abstract serializer class which provides fields common to all order types."""

    export_exclude_fields = ['notes', 'duplicate']

    import_exclude_fields = ['notes', 'duplicate']

    # Number of line items in this order
    line_items = serializers.IntegerField(
        read_only=True, allow_null=True, label=_('Line Items')
    )

    # Number of completed line items (this is an annotated field)
    completed_lines = serializers.IntegerField(
        read_only=True, allow_null=True, label=_('Completed Lines')
    )

    # Human-readable status text (read-only)
    status_text = serializers.CharField(source='get_status_display', read_only=True)

    # status field cannot be set directly
    status = serializers.IntegerField(read_only=True, label=_('Order Status'))

    # Reference string is *required*
    reference = serializers.CharField(required=True)

    # Detail for point-of-contact field
    contact_detail = OptionalField(
        serializer_class=ContactSerializer,
        serializer_kwargs={
            'source': 'contact',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['contact'],
    )

    # Detail for responsible field
    responsible_detail = OptionalField(
        serializer_class=OwnerSerializer,
        serializer_kwargs={
            'source': 'responsible',
            'read_only': True,
            'allow_null': True,
            'many': False,
        },
        default_include=True,
        prefetch_fields=['responsible'],
    )

    project_code_label = common.filters.enable_project_label_filter()
    project_code_detail = common.filters.enable_project_code_filter()

    # Detail for address field
    address_detail = OptionalField(
        serializer_class=AddressBriefSerializer,
        serializer_kwargs={
            'source': 'address',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['address'],
    )

    parameters = common.filters.enable_parameters_filter()

    # Boolean field indicating if this order is overdue (Note: must be annotated)
    overdue = serializers.BooleanField(read_only=True, allow_null=True)

    barcode_hash = serializers.CharField(read_only=True)

    creation_date = serializers.DateField(
        required=False, allow_null=True, label=_('Creation Date')
    )

    created_by = UserSerializer(read_only=True)

    work_ticket_detail = common.serializers.WorkTicketSerializer(
        source='work_ticket', read_only=True, allow_null=True
    )

    duplicate = DuplicateOrderSerializer(
        label=_('Duplicate Order'),
        help_text=_('Specify options for duplicating this order'),
        required=False,
        write_only=True,
    )

    def validate_reference(self, reference):
        """Custom validation for the reference field."""
        self.Meta.model.validate_reference_field(reference)
        return reference

    @staticmethod
    def annotate_queryset(queryset):
        """Add extra information to the queryset."""
        queryset = queryset.annotate(line_items=SubqueryCount('lines'))
        queryset = queryset.select_related('created_by', 'work_ticket')

        return queryset

    @staticmethod
    def order_fields(extra_fields):
        """Construct a set of fields for this serializer."""
        return [
            'pk',
            'created_by',
            'creation_date',
            'issue_date',
            'start_date',
            'target_date',
            'description',
            'line_items',
            'completed_lines',
            'link',
            'project_code',
            'work_ticket',
            'work_ticket_detail',
            'reference',
            'responsible',
            'contact',
            'address',
            'status',
            'status_text',
            'status_custom_key',
            'notes',
            'barcode_hash',
            'overdue',
            'duplicate',
            # Extra detail fields
            'address_detail',
            'contact_detail',
            'project_code_detail',
            'project_code_label',
            'responsible_detail',
            'parameters',
            *extra_fields,
        ]

    def clean_line_item(self, line):
        """Clean a line item object (when duplicating)."""
        line.pk = None
        line.order = self

    def validate_contract(self, contract):
        """Validate that the selected contract matches this order type."""
        if contract is None:
            return contract

        model = self.Meta.model

        if (
            model == order.models.SalesOrder
            and contract.contract_type != order.models.Contract.ContractType.SALES
        ):
            raise ValidationError(_('Sales orders can only link to sales contracts'))

        if (
            model == order.models.PurchaseOrder
            and contract.contract_type != order.models.Contract.ContractType.PURCHASE
        ):
            raise ValidationError(_('Purchase orders can only link to purchase contracts'))

        return contract

    def validate(self, data):
        """Validate order-level contract relationships."""
        data = super().validate(data)
        contract = data.get('contract')

        work_ticket = data.get('work_ticket', getattr(self.instance, 'work_ticket', None))
        request = self.context.get('request')
        if work_ticket:
            allowed_users = {
                work_ticket.assigned_to_id,
                work_ticket.assigned_by_id,
            }
            if work_ticket.plan_id:
                allowed_users.update({
                    work_ticket.plan.manager_id,
                    work_ticket.plan.created_by_id,
                })
            if (
                request
                and not request.user.is_staff
                and request.user.pk not in allowed_users
            ):
                raise ValidationError({
                    'work_ticket': _('Only the ticket assignee or assigner can create linked records')
                })
            data['project_code'] = work_ticket.project_code

        if 'contract' not in data and self.instance is not None:
            contract = self.instance.contracts.first()

        if contract and contract.project_code_id and not data.get('project_code'):
            data['project_code'] = contract.project_code

        project_code = data.get(
            'project_code', getattr(self.instance, 'project_code', None)
        )

        if not project_code:
            raise ValidationError({'project_code': _('Project code is required')})

        if self.Meta.model == order.models.PurchaseOrder:
            output_type = data.get(
                'output_type', getattr(self.instance, 'output_type', None)
            )

            if output_type == order.models.PurchaseOrder.OutputType.COMMERCIAL:
                data['destination'] = None
                data['build_order'] = None
            elif not output_type:
                data['sales_order'] = None
                data['build_order'] = None
            elif output_type:
                data['sales_order'] = None

            sales_order = data.get('sales_order', getattr(self.instance, 'sales_order', None))
            build_order = data.get('build_order', getattr(self.instance, 'build_order', None))
            destination = data.get('destination', getattr(self.instance, 'destination', None))
            build_orders_enabled = common.settings.get_global_setting(
                'BUILDORDER_DISABLED', backup_value=True
            )
            build_orders_enabled = not build_orders_enabled

            if output_type == order.models.PurchaseOrder.OutputType.COMMERCIAL:
                if not sales_order:
                    raise ValidationError({
                        'sales_order': _(
                            'Sales order is required when purchase order output is commercial'
                        )
                    })

                if sales_order.status not in [
                    SalesOrderStatus.PENDING.value,
                    SalesOrderStatus.IN_PROGRESS.value,
                ]:
                    raise ValidationError({
                        'sales_order': _(
                            'Commercial purchase orders can only link to pending or in-progress sales orders'
                        )
                    })

                if contract:
                    if not contract.sales_contract_id:
                        raise ValidationError({
                            'contract': _(
                                'Purchase contract must be linked to a sales contract before linking a sales order'
                            )
                        })

                    if not sales_order.contracts.filter(
                        pk=contract.sales_contract_id
                    ).exists():
                        raise ValidationError({
                            'sales_order': _(
                                'Sales order must be linked to the sales contract associated with the selected purchase contract'
                            )
                        })

            if output_type in (
                order.models.PurchaseOrder.OutputType.WORKSHOP,
                order.models.PurchaseOrder.OutputType.CONSTRUCTION_SITE,
            ):
                if output_type == order.models.PurchaseOrder.OutputType.WORKSHOP:
                    if not build_orders_enabled and build_order:
                        raise ValidationError({
                            'build_order': _(
                                'Build order functionality is currently disabled'
                            )
                        })

                    if destination and build_order:
                        raise ValidationError({
                            'destination': _(
                                'Destination is not allowed when purchase order is linked to a build order'
                            )
                        })

                    if build_order and not build_order.active:
                        raise ValidationError({
                            'build_order': _(
                                'Build order must be pending, on hold, or in production'
                            )
                        })

                    if build_order and build_order.project_code_id != project_code.pk:
                        raise ValidationError({
                            'build_order': _(
                                'Build order project code must match the purchase order project code'
                            )
                        })
                elif build_order:
                    raise ValidationError({
                        'build_order': _(
                            'Build order is only allowed when purchase order output is workshop'
                        )
                    })

                if not destination and not build_order:
                    raise ValidationError({
                        'destination': _(
                            'Destination or build order is required when purchase order output is workshop or construction site'
                        )
                    })

        if contract and contract.project_code_id:
            if project_code and project_code.pk != contract.project_code_id:
                raise ValidationError({
                    'project_code': _('Project code must match the linked contract')
                })

            sales_order = data.get(
                'sales_order', getattr(self.instance, 'sales_order', None)
            )

            if (
                sales_order
                and sales_order.project_code_id
                and sales_order.project_code_id != contract.project_code_id
            ):
                raise ValidationError({
                    'sales_order': _(
                        'Sales order project code must match the linked contract'
                    )
                })

        if contract:
            model = self.Meta.model

            if model == order.models.SalesOrder:
                customer = data.get('customer', getattr(self.instance, 'customer', None))

                if contract.buyer_id:
                    if customer and customer.pk != contract.buyer_id:
                        raise ValidationError({
                            'customer': _('Customer must match the linked contract buyer')
                        })
                    data['customer'] = contract.buyer
                elif not customer:
                    raise ValidationError({
                        'customer': _('Customer is required when the linked contract has no buyer')
                    })

            if model == order.models.PurchaseOrder:
                supplier = data.get('supplier', getattr(self.instance, 'supplier', None))

                if contract.seller_id:
                    if supplier and supplier.pk != contract.seller_id:
                        raise ValidationError({
                            'supplier': _('Supplier must match the linked contract seller')
                        })
                    data['supplier'] = contract.seller
                elif not supplier:
                    raise ValidationError({
                        'supplier': _('Supplier is required when the linked contract has no seller')
                    })

        if contract:
            start_date = data.get(
                'start_date', getattr(self.instance, 'start_date', None)
            )
            target_date = data.get(
                'target_date', getattr(self.instance, 'target_date', None)
            )
            contract_start = contract.issue_date
            contract_end = contract.effective_date

            if start_date and contract_start and start_date < contract_start:
                raise ValidationError({
                    'start_date': _('Start date must be within the contract period')
                })

            if start_date and contract_end and start_date > contract_end:
                raise ValidationError({
                    'start_date': _('Start date must be within the contract period')
                })

            if target_date and contract_start and target_date < contract_start:
                raise ValidationError({
                    'target_date': _('Target date must be within the contract period')
                })

            if target_date and contract_end and target_date > contract_end:
                raise ValidationError({
                    'target_date': _('Target date must be within the contract period')
                })

        if not contract:
            model = self.Meta.model

            if model == order.models.SalesOrder and not data.get(
                'customer', getattr(self.instance, 'customer', None)
            ):
                raise ValidationError({'customer': _('Customer is required')})

            if model == order.models.PurchaseOrder and not data.get(
                'supplier', getattr(self.instance, 'supplier', None)
            ):
                raise ValidationError({'supplier': _('Supplier is required')})

        return data

    def apply_contract_link(self, instance, contract):
        """Apply a selected contract to the order after it has been saved."""
        if contract is serializers.empty:
            return

        if contract is None:
            instance.contracts.clear()
            return

        instance.contracts.set([contract])

    @transaction.atomic
    def create(self, validated_data):
        """Create a new order object.

        Optionally, copy line items from an existing order.
        """
        duplicate = validated_data.pop('duplicate', None)
        contract = validated_data.pop('contract', serializers.empty)

        if (
            contract is not serializers.empty
            and contract is not None
            and contract.project_code_id
        ):
            validated_data['project_code'] = contract.project_code

        if contract is not serializers.empty and contract is not None:
            if isinstance(self, SalesOrderSerializer) and contract.buyer_id:
                validated_data['customer'] = contract.buyer
            if isinstance(self, PurchaseOrderSerializer) and contract.seller_id:
                validated_data['supplier'] = contract.seller

        instance = super().create(validated_data)

        if duplicate:
            order_id = duplicate.get('order_id', None)
            copy_lines = duplicate.get('copy_lines', True)
            copy_extra_lines = duplicate.get('copy_extra_lines', True)
            copy_parameters = duplicate.get('copy_parameters', True)

            try:
                copy_from = instance.__class__.objects.get(pk=order_id)
            except Exception:
                # If the order ID is invalid, raise a validation error
                raise ValidationError(_('Invalid order ID'))

            if copy_lines:
                for line in copy_from.lines.all():
                    instance.clean_line_item(line)
                    line.full_clean()
                    line.save()

            if copy_extra_lines:
                for line in copy_from.extra_lines.all():
                    line.pk = None
                    line.order = instance
                    line.save()

            if copy_parameters:
                instance.copy_parameters_from(copy_from)

        self.apply_contract_link(instance, contract)

        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        """Update an order and apply any selected contract link."""
        contract = validated_data.pop('contract', serializers.empty)

        if (
            contract is not serializers.empty
            and contract is not None
            and contract.project_code_id
        ):
            validated_data['project_code'] = contract.project_code

        if contract is not serializers.empty and contract is not None:
            if isinstance(self, SalesOrderSerializer) and contract.buyer_id:
                validated_data['customer'] = contract.buyer
            if isinstance(self, PurchaseOrderSerializer) and contract.seller_id:
                validated_data['supplier'] = contract.seller

        instance = super().update(instance, validated_data)
        self.apply_contract_link(instance, contract)

        return instance


class AbstractLineItemSerializer(FilterableSerializerMixin, serializers.Serializer):
    """Abstract serializer for LineItem object."""

    @staticmethod
    def line_fields(extra_fields):
        """Construct a set of fields for this serializer."""
        return [
            'pk',
            'line',
            'link',
            'notes',
            'order',
            'project_code',
            'quantity',
            'reference',
            'target_date',
            # Filterable detail fields
            'order_detail',
            'project_code_label',
            'project_code_detail',
            *extra_fields,
        ]

    target_date = serializers.DateField(
        required=False, allow_null=True, label=_('Target Date')
    )

    project_code_label = common.filters.enable_project_label_filter()

    project_code_detail = common.filters.enable_project_code_filter()


class AbstractExtraLineSerializer(
    DataImportExportSerializerMixin, FilterableSerializerMixin, serializers.Serializer
):
    """Abstract Serializer for a ExtraLine object."""

    @staticmethod
    def extra_line_fields(extra_fields):
        """Construct a set of fields for this serializer."""
        return [
            'pk',
            'line',
            'description',
            'link',
            'notes',
            'order',
            'price',
            'price_currency',
            'project_code',
            'quantity',
            'reference',
            'target_date',
            # Filterable detail fields
            'order_detail',
            'project_code_label',
            'project_code_detail',
            *extra_fields,
        ]

    quantity = serializers.FloatField()

    price = InvenTreeMoneySerializer(allow_null=True)

    price_currency = InvenTreeCurrencySerializer()

    project_code_label = common.filters.enable_project_label_filter()

    project_code_detail = common.filters.enable_project_code_filter()


class AbstractExtraLineMeta:
    """Abstract Meta for ExtraLine."""

    fields = [
        'pk',
        'description',
        'quantity',
        'reference',
        'notes',
        'context',
        'order',
        'order_detail',
        'price',
        'price_currency',
        'link',
    ]


@register_importer()
class PurchaseOrderSerializer(
    NotesFieldMixin,
    TotalPriceMixin,
    InvenTreeCustomStatusSerializerMixin,
    AbstractOrderSerializer,
    InvenTreeModelSerializer,
):
    """Serializer for a PurchaseOrder object."""

    contract = serializers.PrimaryKeyRelatedField(
        queryset=order.models.Contract.objects.filter(
            contract_type=order.models.Contract.ContractType.PURCHASE
        ),
        required=False,
        allow_null=True,
        write_only=True,
        label=_('Purchase Contract'),
        help_text=_('Purchase contract linked to this purchase order'),
    )

    class Meta:
        """Metaclass options."""

        model = order.models.PurchaseOrder
        fields = AbstractOrderSerializer.order_fields([
            'complete_date',
            'supplier',
            'supplier_detail',
            'supplier_reference',
            'output_type',
            'sales_order',
            'contract',
            'supplier_name',
            'total_price',
            'order_currency',
            'destination',
            'updated_at',
        ])
        read_only_fields = [
            'issue_date',
            'complete_date',
            'creation_date',
            'updated_at',
        ]
        extra_kwargs = {
            'supplier': {'required': False},
            'order_currency': {'required': False},
        }

    def skip_create_fields(self):
        """Skip these fields when instantiating a new object."""
        fields = super().skip_create_fields()

        return [*fields, 'duplicate', 'contract']

    @staticmethod
    def annotate_queryset(queryset):
        """Add extra information to the queryset.

        - Number of lines in the PurchaseOrder
        - Overdue status of the PurchaseOrder
        """
        queryset = AbstractOrderSerializer.annotate_queryset(queryset)

        queryset = queryset.annotate(
            completed_lines=SubqueryCount(
                'lines', filter=Q(quantity__lte=F('received'))
            )
        )

        queryset = queryset.annotate(
            overdue=Case(
                When(
                    order.models.PurchaseOrder.overdue_filter(),
                    then=Value(True, output_field=BooleanField()),
                ),
                default=Value(False, output_field=BooleanField()),
            )
        )

        queryset = queryset.prefetch_related('created_by')

        return queryset

    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True, label=_('Supplier Name')
    )

    supplier_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={
            'source': 'supplier',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=['supplier'],
    )


class OrderAdjustSerializer(serializers.Serializer):
    """Generic serializer class for adjusting the status of an order."""

    class Meta:
        """Metaclass options.

        By default, there are no fields required for this serializer type.
        """

        fields = []

    @property
    def order(self):
        """Return the order object associated with this serializer.

        Note: It is passed in via the serializer context data.
        """
        return self.context['order']


class PurchaseOrderHoldSerializer(OrderAdjustSerializer):
    """Serializer for placing a PurchaseOrder on hold."""

    def save(self):
        """Save the serializer to 'hold' the order."""
        self.order.hold_order()


class PurchaseOrderCancelSerializer(OrderAdjustSerializer):
    """Serializer for cancelling a PurchaseOrder."""

    def save(self):
        """Save the serializer to 'cancel' the order."""
        if not self.order.can_cancel:
            raise ValidationError(_('Order cannot be cancelled'))

        self.order.cancel_order()


class PurchaseOrderCompleteSerializer(OrderAdjustSerializer):
    """Serializer for completing a purchase order."""

    class Meta:
        """Metaclass options."""

        fields = ['accept_incomplete']

    accept_incomplete = serializers.BooleanField(
        label=_('Accept Incomplete'),
        help_text=_('Allow order to be closed with incomplete line items'),
        required=False,
        default=False,
    )

    def validate_accept_incomplete(self, value):
        """Check if the 'accept_incomplete' field is required."""
        order = self.context['order']

        if not value and not order.is_complete:
            raise ValidationError(_('Order has incomplete line items'))

        return value

    def get_context_data(self):
        """Custom context information for this serializer."""
        order = self.context['order']

        return {'is_complete': order.is_complete}

    def save(self):
        """Save the serializer to 'complete' the order."""
        self.order.complete_order()


class PurchaseOrderIssueSerializer(OrderAdjustSerializer):
    """Serializer for issuing (sending) a purchase order."""

    def save(self):
        """Save the serializer to 'place' the order."""
        self.order.place_order()


@register_importer()
class PurchaseOrderLineItemSerializer(
    DataImportExportSerializerMixin,
    AbstractLineItemSerializer,
    InvenTreeModelSerializer,
):
    """Serializer class for the PurchaseOrderLineItem model."""

    class Meta:
        """Metaclass options."""

        model = order.models.PurchaseOrderLineItem
        fields = AbstractLineItemSerializer.line_fields([
            'part',
            'sales_order_line',
            'build_line',
            'build_order',
            'overdue',
            'received',
            'purchase_price',
            'purchase_price_currency',
            'auto_pricing',
            'destination',
            'total_price',
            'merge_items',
            'sku',
            'mpn',
            'ipn',
            'internal_part',
            'internal_part_name',
            # Filterable detail fields
            'build_order_detail',
            'destination_detail',
            'part_detail',
            'supplier_part_detail',
        ])

    def skip_create_fields(self):
        """Return a list of fields to skip when creating a new object."""
        return ['auto_pricing', 'merge_items', *super().skip_create_fields()]

    @staticmethod
    def annotate_queryset(queryset):
        """Add some extra annotations to this queryset.

        - "total_price" = purchase_price * quantity
        - "overdue" status (boolean field)
        """
        queryset = queryset.prefetch_related(
            'order',
            'order__responsible',
            'order__stock_items',
            'part',
            'part__part',
            'part__part__pricing_data',
            'part__part__default_location',
            'part__supplier',
            'part__manufacturer_part',
            'part__manufacturer_part__manufacturer',
        )

        queryset = queryset.annotate(
            total_price=ExpressionWrapper(
                F('purchase_price') * F('quantity'), output_field=models.DecimalField()
            )
        )

        queryset = queryset.annotate(
            overdue=Case(
                When(
                    order.models.PurchaseOrderLineItem.get_overdue_filter(),
                    then=Value(True, output_field=BooleanField()),
                ),
                default=Value(False, output_field=BooleanField()),
            )
        )

        return queryset

    part = serializers.PrimaryKeyRelatedField(
        queryset=company_models.SupplierPart.objects.all(),
        many=False,
        required=True,
        allow_null=True,
        label=_('Supplier Part'),
    )

    sales_order_line = serializers.PrimaryKeyRelatedField(
        queryset=order.models.SalesOrderLineItem.objects.all(),
        many=False,
        required=False,
        allow_null=True,
        label=_('Sales Order Line Item'),
    )

    build_line = serializers.PrimaryKeyRelatedField(
        queryset=build_models.BuildLine.objects.all(),
        many=False,
        required=False,
        allow_null=True,
        label=_('Build Order Line Item'),
    )

    quantity = serializers.FloatField(min_value=0, required=True)

    def validate_quantity(self, quantity):
        """Validation for the 'quantity' field."""
        if quantity <= 0:
            raise ValidationError(_('Quantity must be greater than zero'))

        return quantity

    def validate_purchase_order(self, purchase_order):
        """Validation for the 'purchase_order' field."""
        if purchase_order.status not in PurchaseOrderStatusGroups.OPEN:
            raise ValidationError(_('Order is not open'))

        return purchase_order

    received = serializers.FloatField(default=0, read_only=True)

    overdue = serializers.BooleanField(read_only=True, allow_null=True)

    total_price = serializers.FloatField(read_only=True)

    part_detail = OptionalField(
        serializer_class=PartBriefSerializer,
        serializer_kwargs={
            'source': 'get_base_part',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=False,
        filter_name='part_detail',
    )

    supplier_part_detail = OptionalField(
        serializer_class=SupplierPartSerializer,
        serializer_kwargs={
            'source': 'part',
            'brief': True,
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=False,
        filter_name='part_detail',
    )

    purchase_price = InvenTreeMoneySerializer(allow_null=True)

    auto_pricing = serializers.BooleanField(
        label=_('Auto Pricing'),
        help_text=_(
            'Automatically calculate purchase price based on supplier part data'
        ),
        default=False,
    )

    destination_detail = OptionalField(
        serializer_class=stock.serializers.LocationBriefSerializer,
        serializer_kwargs={
            'source': 'get_destination',
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['destination', 'order__destination'],
    )

    purchase_price_currency = InvenTreeCurrencySerializer(
        help_text=_('Purchase price currency')
    )

    order_detail = OptionalField(
        serializer_class=PurchaseOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'read_only': True,
            'allow_null': True,
            'many': False,
        },
        default_include=True,
    )

    build_order_detail = OptionalField(
        serializer_class=build.serializers.BuildSerializer,
        serializer_kwargs={
            'source': 'build_order',
            'read_only': True,
            'allow_null': True,
            'many': False,
        },
        default_include=True,
        prefetch_fields=[
            'build_order__responsible',
            'build_order__issued_by',
            'build_order__part',
        ],
    )

    merge_items = serializers.BooleanField(
        label=_('Merge Items'),
        help_text=_(
            'Merge items with the same part, destination and target date into one line item'
        ),
        default=True,
        write_only=True,
    )

    sku = serializers.CharField(
        source='part.SKU', read_only=True, allow_null=True, label=_('SKU')
    )

    mpn = serializers.CharField(
        source='part.manufacturer_part.MPN',
        read_only=True,
        allow_null=True,
        label=_('MPN'),
    )

    ipn = serializers.CharField(
        source='part.part.IPN',
        read_only=True,
        allow_null=True,
        label=_('Internal Part Number'),
    )

    internal_part = serializers.PrimaryKeyRelatedField(
        source='part.part', read_only=True, many=False, label=_('Internal Part')
    )

    internal_part_name = serializers.CharField(
        source='part.part.name', read_only=True, label=_('Internal Part Name')
    )

    def validate(self, data):
        """Custom validation for the serializer.

        - Ensure the supplier_part field is supplied
        - Ensure the purchase_order field is supplied
        - Ensure that the supplier_part and supplier references match
        """
        data = super().validate(data)

        supplier_part = data.get('part', None)
        purchase_order = data.get('order', None)
        sales_order_line = data.get('sales_order_line', None)
        build_line = data.get('build_line', None)

        if not supplier_part:
            raise ValidationError({'part': _('Supplier part must be specified')})

        if not purchase_order:
            raise ValidationError({'order': _('Purchase order must be specified')})

        # Check that the supplier part and purchase order match
        if (
            supplier_part is not None
            and supplier_part.supplier != purchase_order.supplier
        ):
            raise ValidationError({
                'part': _('Supplier must match purchase order'),
                'order': _('Purchase order must match supplier'),
            })

        destination = data.get('destination', getattr(self.instance, 'destination', None))

        if destination:
            purchase_order.validate_output_destination(destination)

        if purchase_order.output_type == order.models.PurchaseOrder.OutputType.COMMERCIAL:
            if sales_order_line is None:
                raise ValidationError({
                    'sales_order_line': _(
                        'Sales order line is required when purchase order output is commercial'
                    )
                })

            if sales_order_line.order_id != purchase_order.sales_order_id:
                raise ValidationError({
                    'sales_order_line': _(
                        'Sales order line must belong to the linked sales order'
                    )
                })

            if supplier_part.part_id != sales_order_line.part_id:
                raise ValidationError({
                    'part': _('Supplier part must match the linked sales order line part')
                })
        elif sales_order_line is not None:
            raise ValidationError({
                'sales_order_line': _(
                    'Sales order line is only allowed when purchase order output is commercial'
                )
            })

        if purchase_order.output_type == order.models.PurchaseOrder.OutputType.WORKSHOP:
            if purchase_order.build_order:
                if build_line is None:
                    raise ValidationError({
                        'build_line': _(
                            'Build order line is required when workshop purchase order is linked to a build order'
                        )
                    })

                if build_line.build_id != purchase_order.build_order_id:
                    raise ValidationError({
                        'build_line': _(
                            'Build order line must belong to the linked build order'
                        )
                    })

                if supplier_part.part_id != build_line.part.pk:
                    raise ValidationError({
                        'part': _('Supplier part must match the linked build order line part')
                    })

                instance = self.instance or order.models.PurchaseOrderLineItem(
                    order=purchase_order,
                    part=supplier_part,
                    build_line=build_line,
                )
                instance.quantity = data.get('quantity', instance.quantity)

                if instance.quantity > instance.build_line_available_quantity():
                    raise ValidationError({
                        'quantity': _(
                            'Quantity exceeds the unallocated build order line quantity'
                        )
                    })
            elif build_line is not None:
                raise ValidationError({
                    'build_line': _(
                        'Build order line is only allowed when purchase order is linked to a build order'
                    )
                })
        elif build_line is not None:
            raise ValidationError({
                'build_line': _(
                    'Build order line is only allowed when purchase order output is workshop'
                )
            })

        return data


@register_importer()
class PurchaseOrderExtraLineSerializer(
    AbstractExtraLineSerializer, InvenTreeModelSerializer
):
    """Serializer for a PurchaseOrderExtraLine object."""

    class Meta(AbstractExtraLineMeta):
        """Metaclass options."""

        model = order.models.PurchaseOrderExtraLine
        fields = AbstractExtraLineSerializer.extra_line_fields([])

    order_detail = OptionalField(
        serializer_class=PurchaseOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )


class PurchaseOrderLineItemReceiveSerializer(serializers.Serializer):
    """A serializer for receiving a single purchase order line item against a purchase order."""

    class Meta:
        """Metaclass options."""

        fields = [
            'barcode',
            'line_item',
            'location',
            'quantity',
            'status',
            'batch_code',
            'expiry_date',
            'serial_numbers',
            'packaging',
            'note',
        ]

    line_item = serializers.PrimaryKeyRelatedField(
        queryset=order.models.PurchaseOrderLineItem.objects.all(),
        allow_null=False,
        required=True,
        label=_('Line Item'),
    )

    location = serializers.PrimaryKeyRelatedField(
        queryset=stock.models.StockLocation.objects.all(),
        many=False,
        allow_null=True,
        required=False,
        label=_('Location'),
        help_text=_('Select destination location for received items'),
    )

    quantity = serializers.DecimalField(
        max_digits=15, decimal_places=5, min_value=Decimal(0), required=True
    )

    def validate_quantity(self, quantity):
        """Validation for the 'quantity' field."""
        if quantity <= 0:
            raise ValidationError(_('Quantity must be greater than zero'))

        return quantity

    batch_code = serializers.CharField(
        label=_('Batch Code'),
        help_text=_('Enter batch code for incoming stock items'),
        required=False,
        default='',
        allow_blank=True,
    )

    expiry_date = serializers.DateField(
        label=_('Expiry Date'),
        help_text=_('Enter expiry date for incoming stock items'),
        required=False,
        allow_null=True,
        default=None,
    )

    serial_numbers = serializers.CharField(
        label=_('Serial Numbers'),
        help_text=_('Enter serial numbers for incoming stock items'),
        required=False,
        default='',
        allow_blank=True,
    )

    status = stock.serializers.StockStatusCustomSerializer(default=StockStatus.OK.value)

    packaging = serializers.CharField(
        label=_('Packaging'),
        help_text=_('Override packaging information for incoming stock items'),
        required=False,
        default='',
        allow_blank=True,
    )

    note = serializers.CharField(
        label=_('Note'),
        help_text=_('Additional note for incoming stock items'),
        required=False,
        default='',
        allow_blank=True,
    )

    barcode = serializers.CharField(
        label=_('Barcode'),
        help_text=_('Scanned barcode'),
        default='',
        required=False,
        allow_null=True,
        allow_blank=True,
    )

    def validate_barcode(self, barcode):
        """Cannot check in a LineItem with a barcode that is already assigned."""
        # Ignore empty barcode values
        if not barcode or barcode.strip() == '':
            return None

        barcode_hash = hash_barcode(barcode)

        if stock.models.StockItem.lookup_barcode(barcode_hash) is not None:
            raise ValidationError(_('Barcode is already in use'))

        return barcode

    def validate(self, data):
        """Custom validation for the serializer.

        - Integer quantity must be provided for serialized stock
        - Validate serial numbers (if provided)
        """
        data = super().validate(data)

        line_item = data['line_item']
        quantity = data['quantity']
        serial_numbers = data.get('serial_numbers', '').strip()

        # If serial numbers are provided
        if serial_numbers:
            supplier_part = line_item.part
            base_part = supplier_part.part
            base_quantity = supplier_part.base_quantity(quantity)

            try:
                # Pass the serial numbers through to the parent serializer once validated
                data['serials'] = extract_serial_numbers(
                    serial_numbers,
                    base_quantity,
                    base_part.get_latest_serial_number(),
                    part=base_part,
                )
            except DjangoValidationError as e:
                raise ValidationError({'serial_numbers': e.messages})

            invalid_serials = []

            # Check the serial numbers are valid
            for serial in data['serials']:
                try:
                    base_part.validate_serial_number(serial, raise_error=True)
                except (ValidationError, DjangoValidationError):
                    invalid_serials.append(serial)

            if len(invalid_serials) > 0:
                msg = _('The following serial numbers already exist or are invalid')
                msg += ': ' + ', '.join(invalid_serials)
                raise ValidationError({'serial_numbers': msg})

        return data


class PurchaseOrderReceiveSerializer(serializers.Serializer):
    """Serializer for receiving items against a PurchaseOrder."""

    class Meta:
        """Metaclass options."""

        fields = ['items', 'location']

    items = PurchaseOrderLineItemReceiveSerializer(many=True)

    location = serializers.PrimaryKeyRelatedField(
        queryset=stock.models.StockLocation.objects.all(),
        many=False,
        required=False,
        allow_null=True,
        label=_('Location'),
        help_text=_('Select destination location for received items'),
    )

    def validate(self, data):
        """Custom validation for the serializer.

        - Ensure line items are provided
        - Check that a location is specified
        """
        super().validate(data)

        purchase_order = self.context['order']
        items = data.get('items', [])

        location = data.get('location', purchase_order.destination)

        if len(items) == 0:
            raise ValidationError(_('Line items must be provided'))

        # Ensure barcodes are unique
        unique_barcodes = set()

        # Check if the location is not specified for any particular item
        for item in items:
            line = item['line_item']
            direct_allocation_order = (
                purchase_order.output_type
                == order.models.PurchaseOrder.OutputType.COMMERCIAL
                or (
                    purchase_order.output_type
                    == order.models.PurchaseOrder.OutputType.WORKSHOP
                    and purchase_order.build_order_id is not None
                )
            )

            if (
                purchase_order.output_type
                == order.models.PurchaseOrder.OutputType.COMMERCIAL
            ):
                if line.order_id != purchase_order.pk:
                    raise ValidationError({_('Line item does not match purchase order')})
                if line.sales_order_line is None:
                    raise ValidationError({
                        'line_item': _(
                            'Commercial purchase line must link to a sales order line'
                        )
                    })
                item['location'] = item.get('location') or location or line.get_destination()

            if purchase_order.output_type == order.models.PurchaseOrder.OutputType.WORKSHOP:
                if line.order_id != purchase_order.pk:
                    raise ValidationError({_('Line item does not match purchase order')})
                if purchase_order.build_order_id is not None and line.build_line is None:
                    raise ValidationError({
                        'line_item': _(
                            'Workshop purchase line must link to a build order line'
                        )
                    })
                item['location'] = item.get('location') or location or line.get_destination()

            if not item.get('location', None):
                # If a global location is specified, use that
                item['location'] = location

            if not item['location']:
                # The line item specifies a location?
                item['location'] = line.get_destination()

            if (
                not item['location']
                and not direct_allocation_order
            ):
                raise ValidationError({
                    'location': _('Destination location must be specified')
                })

            if not direct_allocation_order:
                purchase_order.validate_output_destination(item['location'])

            barcode = item.get('barcode', '')

            if barcode:
                if barcode in unique_barcodes:
                    raise ValidationError(_('Supplied barcode values must be unique'))
                else:
                    unique_barcodes.add(barcode)

        return data

    def save(self) -> list[stock.models.StockItem]:
        """Perform the actual database transaction to receive purchase order items."""
        data = self.validated_data

        request = self.context.get('request')
        purchase_order = self.context['order']

        items = data['items']

        # Location can be provided, or default to the order destination
        location = data.get('location', purchase_order.destination)

        try:
            items = purchase_order.receive_line_items(
                location, items, request.user if request else None
            )
        except (ValidationError, DjangoValidationError) as exc:
            # Catch model errors and re-throw as DRF errors
            raise ValidationError(detail=serializers.as_serializer_error(exc))

        # Returns a list of the created items
        return items


@register_importer()
class SalesOrderSerializer(
    NotesFieldMixin,
    TotalPriceMixin,
    InvenTreeCustomStatusSerializerMixin,
    AbstractOrderSerializer,
    InvenTreeModelSerializer,
):
    """Serializer for the SalesOrder model class."""

    contract = serializers.PrimaryKeyRelatedField(
        queryset=order.models.Contract.objects.filter(
            contract_type=order.models.Contract.ContractType.SALES
        ),
        required=False,
        allow_null=True,
        write_only=True,
        label=_('Sales Contract'),
        help_text=_('Sales contract linked to this sales order'),
    )

    class Meta:
        """Metaclass options."""

        model = order.models.SalesOrder
        fields = AbstractOrderSerializer.order_fields([
            'customer',
            'customer_detail',
            'customer_reference',
            'contract',
            'shipment_date',
            'total_price',
            'order_currency',
            'shipments_count',
            'completed_shipments_count',
            'allocated_lines',
            'updated_at',
        ])
        read_only_fields = ['status', 'creation_date', 'shipment_date', 'updated_at']
        extra_kwargs = {
            'customer': {'required': False},
            'order_currency': {'required': False},
        }

    def skip_create_fields(self):
        """Skip these fields when instantiating a new object."""
        fields = super().skip_create_fields()

        return [*fields, 'duplicate', 'contract']

    @staticmethod
    def annotate_queryset(queryset):
        """Add extra information to the queryset.

        - Number of line items in the SalesOrder
        - Number of fully allocated line items
        - Number of completed line items in the SalesOrder
        - Overdue status of the SalesOrder
        """
        queryset = AbstractOrderSerializer.annotate_queryset(queryset)

        queryset = queryset.annotate(
            completed_lines=SubqueryCount('lines', filter=Q(quantity__lte=F('shipped')))
        )

        queryset = queryset.annotate(
            allocated_lines=SubqueryCount(
                'lines',
                filter=Q(part__virtual=True)
                | Q(shipped__gte=F('quantity'))
                | Q(
                    quantity__lte=Coalesce(
                        SubquerySum('allocations__quantity'), Decimal(0)
                    )
                ),
            )
        )

        queryset = queryset.annotate(
            overdue=Case(
                When(
                    order.models.SalesOrder.overdue_filter(),
                    then=Value(True, output_field=BooleanField()),
                ),
                default=Value(False, output_field=BooleanField()),
            )
        )

        # Annotate shipment details
        queryset = queryset.annotate(
            shipments_count=SubqueryCount('shipments'),
            completed_shipments_count=SubqueryCount(
                'shipments', filter=Q(shipment_date__isnull=False)
            ),
        )

        return queryset

    customer_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={
            'source': 'customer',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=['customer'],
    )

    shipments_count = serializers.IntegerField(
        read_only=True, allow_null=True, label=_('Shipments')
    )

    completed_shipments_count = serializers.IntegerField(
        read_only=True, allow_null=True, label=_('Completed Shipments')
    )

    allocated_lines = serializers.IntegerField(
        read_only=True, allow_null=True, label=_('Allocated Lines')
    )


class SalesOrderIssueSerializer(OrderAdjustSerializer):
    """Serializer for issuing a SalesOrder."""

    def save(self):
        """Save the serializer to 'issue' the order."""
        self.order.issue_order()


@register_importer()
class SalesOrderLineItemSerializer(
    DataImportExportSerializerMixin,
    AbstractLineItemSerializer,
    InvenTreeModelSerializer,
):
    """Serializer for a SalesOrderLineItem object."""

    class Meta:
        """Metaclass options."""

        model = order.models.SalesOrderLineItem
        fields = AbstractLineItemSerializer.line_fields([
            'allocated',
            'customer_detail',
            'overdue',
            'part',
            'part_detail',
            'sale_price',
            'sale_price_currency',
            'shipped',
            # Annotated fields for part stocking information
            'available_stock',
            'available_variant_stock',
            'building',
            'on_order',
            # Filterable detail fields
        ])

    @staticmethod
    def annotate_queryset(queryset):
        """Add some extra annotations to this queryset.

        - "overdue" status (boolean field)
        - "available_quantity"
        - "building"
        - "on_order"
        """
        queryset = queryset.annotate(
            overdue=Case(
                When(
                    Q(order__status__in=SalesOrderStatusGroups.OPEN)
                    & order.models.SalesOrderLineItem.get_overdue_filter(),
                    then=Value(True, output_field=BooleanField()),
                ),
                default=Value(False, output_field=BooleanField()),
            )
        )

        # Annotate each line with the available stock quantity
        # To do this, we need to look at the total stock and any allocations
        queryset = queryset.alias(
            total_stock=part_filters.annotate_total_stock(reference='part__'),
            allocated_to_sales_orders=part_filters.annotate_sales_order_allocations(
                reference='part__'
            ),
            allocated_to_build_orders=part_filters.annotate_build_order_allocations(
                reference='part__'
            ),
        )

        queryset = queryset.annotate(
            available_stock=Greatest(
                ExpressionWrapper(
                    F('total_stock')
                    - F('allocated_to_sales_orders')
                    - F('allocated_to_build_orders'),
                    output_field=models.DecimalField(),
                ),
                0,
                output_field=models.DecimalField(),
            )
        )

        # Filter for "variant" stock: Variant stock items must be salable and active
        variant_stock_query = part_filters.variant_stock_query(
            reference='part__'
        ).filter(part__salable=True, part__active=True)

        # Also add in available "variant" stock
        queryset = queryset.alias(
            variant_stock_total=part_filters.annotate_variant_quantity(
                variant_stock_query, reference='quantity'
            ),
            variant_bo_allocations=part_filters.annotate_variant_quantity(
                variant_stock_query, reference='sales_order_allocations__quantity'
            ),
            variant_so_allocations=part_filters.annotate_variant_quantity(
                variant_stock_query, reference='allocations__quantity'
            ),
        )

        queryset = queryset.annotate(
            available_variant_stock=Greatest(
                ExpressionWrapper(
                    F('variant_stock_total')
                    - F('variant_bo_allocations')
                    - F('variant_so_allocations'),
                    output_field=models.DecimalField(),
                ),
                0,
                output_field=models.DecimalField(),
            )
        )

        # Add information about the quantity of parts currently on order
        queryset = queryset.annotate(
            on_order=part_filters.annotate_on_order_quantity(reference='part__')
        )

        # Add information about the quantity of parts currently in production
        queryset = queryset.annotate(
            building=part_filters.annotate_in_production_quantity(reference='part__')
        )

        # Annotate total 'allocated' stock quantity
        queryset = queryset.annotate(
            allocated=Coalesce(
                SubquerySum('allocations__quantity'),
                Decimal(0),
                output_field=models.DecimalField(),
            )
        )

        return queryset

    order_detail = OptionalField(
        serializer_class=SalesOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=[
            'order__created_by',
            'order__responsible',
            'order__address',
            'order__project_code',
            'order__contact',
        ],
    )

    part_detail = OptionalField(
        serializer_class=PartBriefSerializer,
        serializer_kwargs={
            'source': 'part',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=['part__pricing_data'],
    )

    customer_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={
            'source': 'order.customer',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=['order__customer'],
    )

    # Annotated fields
    overdue = serializers.BooleanField(read_only=True, allow_null=True)
    available_stock = serializers.FloatField(read_only=True)
    available_variant_stock = serializers.FloatField(read_only=True)
    on_order = serializers.FloatField(label=_('On Order'), read_only=True)
    building = serializers.FloatField(label=_('In Production'), read_only=True)

    quantity = InvenTreeDecimalField()

    allocated = serializers.FloatField(read_only=True)

    shipped = InvenTreeDecimalField(read_only=True)

    sale_price = InvenTreeMoneySerializer(allow_null=True)

    sale_price_currency = InvenTreeCurrencySerializer(
        help_text=_('Sale price currency')
    )


@register_importer()
class SalesOrderShipmentSerializer(
    DataImportExportSerializerMixin,
    FilterableSerializerMixin,
    NotesFieldMixin,
    InvenTreeModelSerializer,
):
    """Serializer for the SalesOrderShipment class."""

    class Meta:
        """Metaclass options."""

        model = order.models.SalesOrderShipment
        fields = [
            'pk',
            'order',
            'allocated_items',
            'shipment_date',
            'shipment_address',
            'delivery_date',
            'checked_by',
            'reference',
            'tracking_number',
            'invoice_number',
            'barcode_hash',
            'link',
            'notes',
            # Extra detail fields
            'parameters',
            'checked_by_detail',
            'customer_detail',
            'order_detail',
            'shipment_address_detail',
        ]

    @staticmethod
    def annotate_queryset(queryset):
        """Annotate the queryset with extra information."""
        queryset = queryset.annotate(allocated_items=SubqueryCount('allocations'))

        return queryset

    allocated_items = serializers.IntegerField(
        read_only=True, allow_null=True, label=_('Allocated Items')
    )

    checked_by_detail = OptionalField(
        serializer_class=UserSerializer,
        serializer_kwargs={
            'source': 'checked_by',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['checked_by'],
    )

    order_detail = OptionalField(
        serializer_class=SalesOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=[
            'order',
            'order__customer',
            'order__created_by',
            'order__responsible',
            'order__project_code',
        ],
    )

    customer_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={
            'source': 'order.customer',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=False,
        prefetch_fields=['order__customer'],
    )

    shipment_address_detail = OptionalField(
        serializer_class=AddressBriefSerializer,
        serializer_kwargs={
            'source': 'shipment_address',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['shipment_address'],
    )

    parameters = common.filters.enable_parameters_filter()


class SalesOrderAllocationSerializer(
    FilterableSerializerMixin, InvenTreeModelSerializer
):
    """Serializer for the SalesOrderAllocation model.

    This includes some fields from the related model objects.
    """

    class Meta:
        """Metaclass options."""

        model = order.models.SalesOrderAllocation
        fields = [
            'pk',
            'item',
            'quantity',
            'shipment',
            # Annotated read-only fields
            'line',
            'part',
            'order',
            'serial',
            'location',
            # Extra detail fields
            'item_detail',
            'part_detail',
            'order_detail',
            'customer_detail',
            'location_detail',
            'shipment_detail',
        ]
        read_only_fields = ['line', '']

    part = serializers.PrimaryKeyRelatedField(source='item.part', read_only=True)
    order = serializers.PrimaryKeyRelatedField(
        source='line.order', many=False, read_only=True
    )
    serial = serializers.CharField(source='get_serial', read_only=True, allow_null=True)
    quantity = serializers.FloatField(read_only=False)
    location = serializers.PrimaryKeyRelatedField(
        source='item.location', many=False, read_only=True
    )

    # Extra detail fields
    order_detail = OptionalField(
        serializer_class=SalesOrderSerializer,
        serializer_kwargs={
            'source': 'line.order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )

    part_detail = OptionalField(
        serializer_class=PartBriefSerializer,
        serializer_kwargs={
            'source': 'item.part',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
    )

    item_detail = OptionalField(
        serializer_class=stock.serializers.StockItemSerializer,
        serializer_kwargs={
            'source': 'item',
            'many': False,
            'read_only': True,
            'allow_null': True,
            'part_detail': False,
            'location_detail': False,
            'supplier_part_detail': False,
        },
        default_include=True,
    )
    location_detail = OptionalField(
        serializer_class=stock.serializers.LocationBriefSerializer,
        serializer_kwargs={
            'source': 'item.location',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )

    customer_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={
            'source': 'line.order.customer',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )

    shipment_detail = OptionalField(
        serializer_class=SalesOrderShipmentSerializer,
        serializer_kwargs={
            'source': 'shipment',
            'order_detail': False,
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        default_include=True,
        prefetch_fields=['shipment'],
    )


class SalesOrderShipmentCompleteSerializer(serializers.ModelSerializer):
    """Serializer for completing (shipping) a SalesOrderShipment."""

    class Meta:
        """Metaclass options."""

        model = order.models.SalesOrderShipment

        fields = [
            'shipment_date',
            'delivery_date',
            'tracking_number',
            'invoice_number',
            'link',
        ]

    def validate(self, data):
        """Custom validation for the serializer.

        - Ensure the shipment reference is provided
        """
        data = super().validate(data)

        shipment = self.context.get('shipment', None)

        if not shipment:
            raise ValidationError(_('No shipment details provided'))

        shipment.check_can_complete(raise_error=True)

        return data


class SalesOrderShipmentAllocationItemSerializer(serializers.Serializer):
    """A serializer for allocating a single stock-item against a SalesOrder shipment."""

    class Meta:
        """Metaclass options."""

        fields = ['line_item', 'stock_item', 'quantity']

    line_item = serializers.PrimaryKeyRelatedField(
        queryset=order.models.SalesOrderLineItem.objects.all(),
        many=False,
        allow_null=False,
        required=True,
        label=_('Stock Item'),
    )

    def validate_line_item(self, line_item):
        """Custom validation for the 'line_item' field.

        - Ensure the line_item is associated with the particular SalesOrder
        """
        order = self.context['order']

        # Ensure that the line item points to the correct order
        if line_item.order != order:
            raise ValidationError(_('Line item is not associated with this order'))

        return line_item

    stock_item = serializers.PrimaryKeyRelatedField(
        queryset=stock.models.StockItem.objects.all(),
        many=False,
        allow_null=False,
        required=True,
        label=_('Stock Item'),
    )

    quantity = serializers.DecimalField(
        max_digits=15, decimal_places=5, min_value=Decimal(0), required=True
    )

    def validate_quantity(self, quantity):
        """Custom validation for the 'quantity' field."""
        if quantity <= 0:
            raise ValidationError(_('Quantity must be positive'))

        return quantity

    def validate(self, data):
        """Custom validation for the serializer.

        - Ensure that the quantity is 1 for serialized stock
        - Quantity cannot exceed the available amount
        """
        data = super().validate(data)

        stock_item = data['stock_item']
        quantity = data['quantity']

        if stock_item.serialized and quantity != 1:
            raise ValidationError({
                'quantity': _('Quantity must be 1 for serialized stock item')
            })

        q = normalize(stock_item.unallocated_quantity())

        if quantity > q:
            raise ValidationError({'quantity': _(f'Available quantity ({q}) exceeded')})

        return data


class SalesOrderCompleteSerializer(OrderAdjustSerializer):
    """DRF serializer for manually marking a sales order as complete."""

    class Meta:
        """Serializer metaclass options."""

        fields = ['accept_incomplete']

    accept_incomplete = serializers.BooleanField(
        label=_('Accept Incomplete'),
        help_text=_('Allow order to be closed with incomplete line items'),
        required=False,
        default=False,
    )

    def validate_accept_incomplete(self, value):
        """Check if the 'accept_incomplete' field is required."""
        order = self.context['order']

        if not value and not order.is_completed():
            raise ValidationError(_('Order has incomplete line items'))

        return value

    def get_context_data(self):
        """Custom context data for this serializer."""
        order = self.context['order']

        return {
            'is_complete': order.is_completed(),
            'pending_shipments': order.pending_shipment_count,
        }

    def validate(self, data):
        """Custom validation for the serializer."""
        data = super().validate(data)
        self.order.can_complete(
            raise_error=True,
            allow_incomplete_lines=str2bool(data.get('accept_incomplete', False)),
        )

        return data

    def save(self):
        """Save the serializer to complete the SalesOrder."""
        request = self.context.get('request')
        data = self.validated_data

        user = request.user if request else None

        self.order.ship_order(
            user, allow_incomplete_lines=str2bool(data.get('accept_incomplete', False))
        )


class SalesOrderHoldSerializer(OrderAdjustSerializer):
    """Serializer for placing a SalesOrder on hold."""

    def save(self):
        """Save the serializer to place the SalesOrder on hold."""
        self.order.hold_order()


class SalesOrderCancelSerializer(OrderAdjustSerializer):
    """Serializer for marking a SalesOrder as cancelled."""

    def get_context_data(self):
        """Add extra context data to the serializer."""
        order = self.context['order']

        return {'can_cancel': order.can_cancel}

    def save(self):
        """Save the serializer to cancel the order."""
        self.order.cancel_order()


class SalesOrderSerialAllocationSerializer(serializers.Serializer):
    """DRF serializer for allocation of serial numbers against a sales order / shipment."""

    class Meta:
        """Metaclass options."""

        fields = ['line_item', 'quantity', 'serial_numbers', 'shipment']

    line_item = serializers.PrimaryKeyRelatedField(
        queryset=order.models.SalesOrderLineItem.objects.all(),
        many=False,
        required=True,
        allow_null=False,
        label=_('Line Item'),
    )

    def validate_line_item(self, line_item):
        """Ensure that the line_item is valid."""
        order = self.context['order']

        # Ensure that the line item points to the correct order
        if line_item.order != order:
            raise ValidationError(_('Line item is not associated with this order'))

        return line_item

    quantity = serializers.IntegerField(
        min_value=1, required=True, allow_null=False, label=_('Quantity')
    )

    serial_numbers = serializers.CharField(
        label=_('Serial Numbers'),
        help_text=_('Enter serial numbers to allocate'),
        required=True,
        allow_blank=False,
    )

    shipment = serializers.PrimaryKeyRelatedField(
        queryset=order.models.SalesOrderShipment.objects.all(),
        many=False,
        required=False,
        allow_null=True,
        label=_('Shipment'),
    )

    def validate_shipment(self, shipment):
        """Validate the shipment.

        - Must point to the same order
        - Must not be shipped
        """
        order = self.context['order']

        if shipment and shipment.shipment_date is not None:
            raise ValidationError(_('Shipment has already been shipped'))

        if shipment and shipment.order != order:
            raise ValidationError(_('Shipment is not associated with this order'))

        return shipment

    def validate(self, data):
        """Validation for the serializer.

        - Ensure the serial_numbers and quantity fields match
        - Check that all serial numbers exist
        - Check that the serial numbers are not yet allocated
        """
        data = super().validate(data)

        line_item = data['line_item']
        quantity = data['quantity']
        serial_numbers = data['serial_numbers']

        part = line_item.part

        try:
            data['serials'] = extract_serial_numbers(
                serial_numbers, quantity, part.get_latest_serial_number(), part=part
            )
        except DjangoValidationError as e:
            raise ValidationError({'serial_numbers': e.messages})

        serials_not_exist = set()
        serials_unavailable = set()
        stock_items_to_allocate = []

        for serial in data['serials']:
            serial = str(serial).strip()

            items = stock.models.StockItem.objects.filter(
                part=part, serial=serial, quantity=1
            )

            if not items.exists():
                serials_not_exist.add(str(serial))
                continue

            stock_item = items[0]

            if not stock_item.in_stock:
                serials_unavailable.add(str(serial))
                continue

            if stock_item.unallocated_quantity() < 1:
                serials_unavailable.add(str(serial))
                continue

            # At this point, the serial number is valid, and can be added to the list
            stock_items_to_allocate.append(stock_item)

        if len(serials_not_exist) > 0:
            error_msg = _('No match found for the following serial numbers')
            error_msg += ': '
            error_msg += ','.join(sorted(serials_not_exist))

            raise ValidationError({'serial_numbers': error_msg})

        if len(serials_unavailable) > 0:
            error_msg = _('The following serial numbers are unavailable')
            error_msg += ': '
            error_msg += ','.join(sorted(serials_unavailable))

            raise ValidationError({'serial_numbers': error_msg})

        data['stock_items'] = stock_items_to_allocate

        return data

    def save(self):
        """Allocate stock items against the sales order."""
        data = self.validated_data

        line_item = data['line_item']
        stock_items = data['stock_items']
        shipment = data.get('shipment', None)

        allocations = []

        for stock_item in stock_items:
            # Create a new SalesOrderAllocation
            allocations.append(
                order.models.SalesOrderAllocation(
                    line=line_item, item=stock_item, quantity=1, shipment=shipment
                )
            )

        with transaction.atomic():
            order.models.SalesOrderAllocation.objects.bulk_create(allocations)


class SalesOrderShipmentAllocationSerializer(serializers.Serializer):
    """DRF serializer for allocation of stock items against a sales order / shipment."""

    class Meta:
        """Metaclass options."""

        fields = ['items', 'shipment']

    items = SalesOrderShipmentAllocationItemSerializer(many=True)

    shipment = serializers.PrimaryKeyRelatedField(
        queryset=order.models.SalesOrderShipment.objects.all(),
        many=False,
        required=False,
        allow_null=True,
        label=_('Shipment'),
    )

    def validate_shipment(self, shipment):
        """Run validation against the provided shipment instance."""
        order = self.context['order']

        if shipment and shipment.shipment_date is not None:
            raise ValidationError(_('Shipment has already been shipped'))

        if shipment and shipment.order != order:
            raise ValidationError(_('Shipment is not associated with this order'))

        return shipment

    def validate(self, data):
        """Serializer validation."""
        data = super().validate(data)

        # Extract SalesOrder from serializer context
        # order = self.context['order']

        items = data.get('items', [])

        if len(items) == 0:
            raise ValidationError(_('Allocation items must be provided'))

        return data

    def save(self):
        """Perform the allocation of items against this order."""
        data = self.validated_data

        items = data['items']
        shipment = data.get('shipment')

        with transaction.atomic():
            for entry in items:
                # Create a new SalesOrderAllocation
                allocation = order.models.SalesOrderAllocation(
                    line=entry.get('line_item'),
                    item=entry.get('stock_item'),
                    quantity=entry.get('quantity'),
                    shipment=shipment,
                )

                allocation.full_clean()
                allocation.save()


@register_importer()
class SalesOrderExtraLineSerializer(
    AbstractExtraLineSerializer, InvenTreeModelSerializer
):
    """Serializer for a SalesOrderExtraLine object."""

    class Meta(AbstractExtraLineMeta):
        """Metaclass options."""

        model = order.models.SalesOrderExtraLine
        fields = AbstractExtraLineSerializer.extra_line_fields([])

    order_detail = OptionalField(
        serializer_class=SalesOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )


@register_importer()
class ReturnOrderSerializer(
    NotesFieldMixin,
    InvenTreeCustomStatusSerializerMixin,
    AbstractOrderSerializer,
    TotalPriceMixin,
    InvenTreeModelSerializer,
):
    """Serializer for the ReturnOrder model class."""

    class Meta:
        """Metaclass options."""

        model = order.models.ReturnOrder
        fields = AbstractOrderSerializer.order_fields([
            'complete_date',
            'customer',
            'customer_detail',
            'customer_reference',
            'order_currency',
            'total_price',
            'updated_at',
        ])
        read_only_fields = ['creation_date', 'updated_at']

    def skip_create_fields(self):
        """Skip these fields when instantiating a new object."""
        fields = super().skip_create_fields()

        return [*fields, 'duplicate']

    @staticmethod
    def annotate_queryset(queryset):
        """Custom annotation for the serializer queryset."""
        queryset = AbstractOrderSerializer.annotate_queryset(queryset)

        queryset = queryset.annotate(
            completed_lines=SubqueryCount(
                'lines', filter=~Q(outcome=ReturnOrderLineStatus.PENDING.value)
            )
        )

        queryset = queryset.annotate(
            overdue=Case(
                When(
                    order.models.ReturnOrder.overdue_filter(),
                    then=Value(True, output_field=BooleanField()),
                ),
                default=Value(False, output_field=BooleanField()),
            )
        )

        return queryset

    customer_detail = OptionalField(
        serializer_class=CompanyBriefSerializer,
        serializer_kwargs={
            'source': 'customer',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=['customer'],
    )


class ReturnOrderHoldSerializer(OrderAdjustSerializer):
    """Serializers for holding a ReturnOrder."""

    def save(self):
        """Save the serializer to 'hold' the order."""
        self.order.hold_order()


class ReturnOrderIssueSerializer(OrderAdjustSerializer):
    """Serializer for issuing a ReturnOrder."""

    def save(self):
        """Save the serializer to 'issue' the order."""
        self.order.issue_order()


class ReturnOrderCancelSerializer(OrderAdjustSerializer):
    """Serializer for cancelling a ReturnOrder."""

    def save(self):
        """Save the serializer to 'cancel' the order."""
        self.order.cancel_order()


class ReturnOrderCompleteSerializer(OrderAdjustSerializer):
    """Serializer for completing a ReturnOrder."""

    def save(self):
        """Save the serializer to 'complete' the order."""
        self.order.complete_order()


class ReturnOrderLineItemReceiveSerializer(serializers.Serializer):
    """Serializer for receiving a single line item against a ReturnOrder."""

    class Meta:
        """Metaclass options."""

        fields = ['item', 'status']

    item = serializers.PrimaryKeyRelatedField(
        queryset=order.models.ReturnOrderLineItem.objects.all(),
        many=False,
        allow_null=False,
        required=True,
        label=_('Return order line item'),
    )

    status = stock.serializers.StockStatusCustomSerializer(
        default=None, required=False, allow_blank=True
    )

    def validate_line_item(self, item):
        """Validation for a single line item."""
        if item.order != self.context['order']:
            raise ValidationError(_('Line item does not match return order'))

        if item.received:
            raise ValidationError(_('Line item has already been received'))

        return item


class ReturnOrderReceiveSerializer(serializers.Serializer):
    """Serializer for receiving items against a ReturnOrder."""

    class Meta:
        """Metaclass options."""

        fields = ['items', 'location', 'note']

    items = ReturnOrderLineItemReceiveSerializer(many=True)

    location = serializers.PrimaryKeyRelatedField(
        queryset=stock.models.StockLocation.objects.all(),
        many=False,
        allow_null=False,
        required=True,
        label=_('Location'),
        help_text=_('Select destination location for received items'),
    )

    note = serializers.CharField(
        label=_('Note'),
        help_text=_('Additional note for incoming stock items'),
        required=False,
        default='',
        allow_blank=True,
    )

    def validate(self, data):
        """Perform data validation for this serializer."""
        order = self.context['order']
        if order.status != ReturnOrderStatus.IN_PROGRESS:
            raise ValidationError(
                _('Items can only be received against orders which are in progress')
            )

        data = super().validate(data)

        items = data.get('items', [])

        if len(items) == 0:
            raise ValidationError(_('Line items must be provided'))

        return data

    @transaction.atomic
    def save(self):
        """Saving this serializer marks the returned items as received."""
        order = self.context['order']
        request = self.context.get('request')

        data = self.validated_data
        items = data['items']
        location = data['location']

        with transaction.atomic():
            for item in items:
                line_item = item['item']

                order.receive_line_item(
                    line_item,
                    location,
                    request.user if request else None,
                    note=data.get('note', ''),
                    status=item.get('status', None),
                )


@register_importer()
class ReturnOrderLineItemSerializer(
    DataImportExportSerializerMixin,
    AbstractLineItemSerializer,
    InvenTreeModelSerializer,
):
    """Serializer for a ReturnOrderLineItem object."""

    class Meta:
        """Metaclass options."""

        model = order.models.ReturnOrderLineItem
        fields = AbstractLineItemSerializer.line_fields([
            'item',
            'received_date',
            'outcome',
            'price',
            'price_currency',
            # Filterable detail fields
            'item_detail',
            'part_detail',
        ])

    order_detail = OptionalField(
        serializer_class=ReturnOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=[
            'order__created_by',
            'order__responsible',
            'order__address',
            'order__project_code',
            'order__contact',
        ],
    )

    quantity = serializers.FloatField(
        label=_('Quantity'), help_text=_('Quantity to return')
    )

    item_detail = OptionalField(
        serializer_class=stock.serializers.StockItemSerializer,
        serializer_kwargs={
            'source': 'item',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
        prefetch_fields=['item__supplier_part'],
    )

    part_detail = OptionalField(
        serializer_class=PartBriefSerializer,
        serializer_kwargs={
            'source': 'item.part',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )

    price = InvenTreeMoneySerializer(allow_null=True)
    price_currency = InvenTreeCurrencySerializer(help_text=_('Line price currency'))


@register_importer()
class ReturnOrderExtraLineSerializer(
    AbstractExtraLineSerializer, InvenTreeModelSerializer
):
    """Serializer for a ReturnOrderExtraLine object."""

    class Meta(AbstractExtraLineMeta):
        """Metaclass options."""

        model = order.models.ReturnOrderExtraLine
        fields = AbstractExtraLineSerializer.extra_line_fields([])

    order_detail = OptionalField(
        serializer_class=ReturnOrderSerializer,
        serializer_kwargs={
            'source': 'order',
            'many': False,
            'read_only': True,
            'allow_null': True,
        },
    )
