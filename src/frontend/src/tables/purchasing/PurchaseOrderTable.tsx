import { t } from '@lingui/core/macro';
import { useMemo } from 'react';

import { AddItemButton } from '@lib/components/AddItemButton';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import { formatCurrency } from '../../defaults/formatters';
import { usePurchaseOrderFields } from '../../forms/PurchaseOrderForms';
import { useCreateApiFormModal } from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import {
  CompanyColumn,
  CompletionDateColumn,
  CreatedByColumn,
  CreationDateColumn,
  DescriptionColumn,
  LineItemsProgressColumn,
  LinkColumn,
  ProjectCodeColumn,
  ReferenceColumn,
  ResponsibleColumn,
  StartDateColumn,
  StatusColumn,
  TargetDateColumn,
  UpdatedAtColumn
} from '../ColumnRenderers';
import {
  AssignedToMeFilter,
  CompletedAfterFilter,
  CompletedBeforeFilter,
  CreatedAfterFilter,
  CreatedBeforeFilter,
  CreatedByFilter,
  HasProjectCodeFilter,
  MaxDateFilter,
  MinDateFilter,
  OrderStatusFilter,
  OutstandingFilter,
  OverdueFilter,
  ProjectCodeFilter,
  ResponsibleFilter,
  StartDateAfterFilter,
  StartDateBeforeFilter,
  TargetDateAfterFilter,
  TargetDateBeforeFilter,
  UpdatedAfterFilter,
  UpdatedBeforeFilter
} from '../Filter';
import { InvenTreeTable } from '../InvenTreeTable';

/**
 * Display a table of purchase orders
 */
export function PurchaseOrderTable({
  supplierId,
  supplierPartId,
  externalBuildId,
  workTicketId,
  workTicketProjectCodeId,
  salesOrderId,
  contractId,
  contractBuyerId,
  contractSellerId,
  defaultOutstanding = true,
  onSelectPurchaseOrder,
  selectedPurchaseOrderId
}: Readonly<{
  supplierId?: number;
  supplierPartId?: number;
  externalBuildId?: number;
  workTicketId?: number;
  workTicketProjectCodeId?: number;
  salesOrderId?: number;
  contractId?: number;
  contractBuyerId?: number;
  contractSellerId?: number;
  defaultOutstanding?: boolean;
  onSelectPurchaseOrder?: (record: any) => void;
  selectedPurchaseOrderId?: number;
}>) {
  const table = useTable(contractId ? 'purchase-order-contract' : 'purchase-order', {
    initialFilters: defaultOutstanding
      ? [
          {
            name: 'outstanding',
            value: 'true'
          }
        ]
      : []
  });
  const user = useUserState();

  const tableFilters: TableFilter[] = useMemo(() => {
    return [
      OrderStatusFilter({ model: ModelType.purchaseorder }),
      OutstandingFilter(),
      OverdueFilter(),
      AssignedToMeFilter(),
      MinDateFilter(),
      MaxDateFilter(),
      CreatedBeforeFilter(),
      CreatedAfterFilter(),
      TargetDateBeforeFilter(),
      TargetDateAfterFilter(),
      StartDateBeforeFilter(),
      StartDateAfterFilter(),
      {
        name: 'has_target_date',
        type: 'boolean',
        label: t`Has Target Date`,
        description: t`Show orders with a target date`
      },
      {
        name: 'has_start_date',
        type: 'boolean',
        label: t`Has Start Date`,
        description: t`Show orders with a start date`
      },
      CompletedBeforeFilter(),
      CompletedAfterFilter(),
      UpdatedBeforeFilter(),
      UpdatedAfterFilter(),
      ProjectCodeFilter(),
      HasProjectCodeFilter(),
      ResponsibleFilter(),
      CreatedByFilter()
    ];
  }, []);

  const tableColumns = useMemo(() => {
    return [
      ReferenceColumn({
        switchable: false
      }),
      DescriptionColumn({}),
      {
        accessor: 'supplier__name',
        title: t`Supplier`,
        sortable: true,
        render: (record: any) => (
          <CompanyColumn company={record.supplier_detail} />
        )
      },
      {
        accessor: 'supplier_reference',
        copyable: true
      },
      LineItemsProgressColumn({}),
      StatusColumn({ model: ModelType.purchaseorder }),
      ProjectCodeColumn({
        defaultVisible: false
      }),
      {
        accessor: 'work_ticket_detail.code',
        title: 'Mã công việc',
        render: (record: any) => record.work_ticket_detail?.code ?? '-'
      },
      CreationDateColumn({
        defaultVisible: false
      }),
      CreatedByColumn({
        defaultVisible: false
      }),
      StartDateColumn({
        defaultVisible: false
      }),
      TargetDateColumn({}),
      CompletionDateColumn({
        accessor: 'complete_date'
      }),
      UpdatedAtColumn({
        defaultVisible: false
      }),
      {
        accessor: 'total_price',
        title: t`Total Price`,
        sortable: true,
        render: (record: any) => {
          return formatCurrency(record.total_price, {
            currency: record.order_currency || record.supplier_detail?.currency
          });
        }
      },
      ResponsibleColumn({}),
      LinkColumn({})
    ];
  }, []);

  const purchaseOrderFields = usePurchaseOrderFields({
    create: true,
    projectCodeId: workTicketProjectCodeId
  });

  const newPurchaseOrder = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: t`Add Purchase Order`,
    fields: {
      ...purchaseOrderFields,
      ...(workTicketId
        ? { work_ticket: { field_type: 'number' as const, hidden: true, value: workTicketId } }
        : {})
    },
    initialData: {
      supplier: supplierId,
      sales_order: salesOrderId,
      contract: contractId,
      work_ticket: workTicketId,
      project_code: workTicketProjectCodeId
    },
    follow: true,
    modelType: ModelType.purchaseorder,
    keepOpenOption: true
  });

  const tableActions = useMemo(() => {
    return [
      <AddItemButton
        key='add-purchase-order'
        tooltip={t`Add Purchase Order`}
        onClick={() => newPurchaseOrder.open()}
        hidden={!user.hasAddRole(UserRoles.purchase_order)}
      />
    ];
  }, [user]);

  return (
    <>
      {newPurchaseOrder.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.purchase_order_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          params: {
            supplier_detail: true,
            supplier: supplierId,
            supplier_part: supplierPartId,
            external_build: externalBuildId,
            work_ticket: workTicketId,
            sales_order: salesOrderId,
            contract: contractId,
            contract_buyer: contractBuyerId,
            contract_seller: contractSellerId
          },
          tableFilters: tableFilters,
          tableActions: tableActions,
          modelType: ModelType.purchaseorder,
          enableSelection: true,
          enableDownload: true,
          enableReports: true,
          enableLabels: true,
          onRowClick: onSelectPurchaseOrder,
          rowStyle: (record: any) =>
            record.pk === selectedPurchaseOrderId
              ? { backgroundColor: 'var(--mantine-color-blue-light)' }
              : undefined
        }}
      />
    </>
  );
}
