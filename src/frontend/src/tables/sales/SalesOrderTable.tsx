import { t } from '@lingui/core/macro';
import { useMemo } from 'react';

import { AddItemButton } from '@lib/components/AddItemButton';
import { ProgressBar } from '@lib/components/ProgressBar';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import { formatCurrency } from '../../defaults/formatters';
import { useSalesOrderFields } from '../../forms/SalesOrderForms';
import { useCreateApiFormModal } from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import {
  AllocatedLinesProgressColumn,
  CompanyColumn,
  CreatedByColumn,
  CreationDateColumn,
  DescriptionColumn,
  LineItemsProgressColumn,
  LinkColumn,
  ProjectCodeColumn,
  ReferenceColumn,
  ResponsibleColumn,
  ShipmentDateColumn,
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
  IncludeVariantsFilter,
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

export function SalesOrderTable({
  partId,
  customerId,
  contractId,
  contractBuyerId,
  contractSellerId,
  workTicketId,
  workTicketProjectCodeId,
  defaultOutstanding = true,
  hasProjectCode,
  onSelectSalesOrder,
  selectedSalesOrderId
}: Readonly<{
  partId?: number;
  customerId?: number;
  contractId?: number;
  contractBuyerId?: number;
  contractSellerId?: number;
  workTicketId?: number;
  workTicketProjectCodeId?: number;
  defaultOutstanding?: boolean;
  hasProjectCode?: boolean;
  onSelectSalesOrder?: (record: any) => void;
  selectedSalesOrderId?: number;
}>) {
  const table = useTable(
    contractId ? 'salesorder-contract' : !!partId ? 'salesorder-part' : 'salesorder-index',
    {
      initialFilters: defaultOutstanding
        ? [
            {
              name: 'outstanding',
              value: 'true'
            }
          ]
        : []
    }
  );
  const user = useUserState();

  const tableFilters: TableFilter[] = useMemo(() => {
    const filters: TableFilter[] = [
      OrderStatusFilter({ model: ModelType.salesorder }),
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
      HasProjectCodeFilter(),
      ProjectCodeFilter(),
      ResponsibleFilter(),
      CreatedByFilter()
    ];

    if (!!partId) {
      filters.push(IncludeVariantsFilter());
    }

    return filters;
  }, [partId]);

  const salesOrderFields = useSalesOrderFields({
    create: true,
    projectCodeId: workTicketProjectCodeId
  });

  const newSalesOrder = useCreateApiFormModal({
    url: ApiEndpoints.sales_order_list,
    title: t`Add Sales Order`,
    fields: {
      ...salesOrderFields,
      ...(workTicketId
        ? { work_ticket: { field_type: 'number' as const, hidden: true, value: workTicketId } }
        : {})
    },
    initialData: {
      customer: customerId,
      contract: contractId,
      work_ticket: workTicketId,
      project_code: workTicketProjectCodeId
    },
    follow: true,
    modelType: ModelType.salesorder,
    keepOpenOption: true
  });

  const tableActions = useMemo(() => {
    return [
      <AddItemButton
        key='add-sales-order'
        tooltip={t`Add Sales Order`}
        onClick={() => newSalesOrder.open()}
        hidden={!user.hasAddRole(UserRoles.sales_order)}
      />
    ];
  }, [user]);

  const tableColumns = useMemo(() => {
    return [
      ReferenceColumn({}),
      {
        accessor: 'customer__name',
        title: t`Customer`,
        sortable: true,
        render: (record: any) => (
          <CompanyColumn company={record.customer_detail} />
        )
      },
      {
        accessor: 'customer_reference',
        title: t`Customer Reference`,
        copyable: true
      },
      DescriptionColumn({}),
      LineItemsProgressColumn({}),
      AllocatedLinesProgressColumn({
        defaultVisible: false
      }),
      {
        accessor: 'shipments_count',
        title: t`Shipments`,
        minWidth: 125,
        render: (record: any) => (
          <ProgressBar
            progressLabel
            value={record.completed_shipments_count}
            maximum={record.shipments_count}
          />
        )
      },
      StatusColumn({ model: ModelType.salesorder }),
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
      ShipmentDateColumn({}),
      UpdatedAtColumn({
        defaultVisible: false
      }),
      ResponsibleColumn({}),
      {
        accessor: 'total_price',
        title: t`Total Price`,
        sortable: true,
        render: (record: any) => {
          return formatCurrency(record.total_price, {
            currency: record.order_currency || record.customer_detail?.currency
          });
        }
      },
      LinkColumn({})
    ];
  }, []);

  return (
    <>
      {newSalesOrder.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.sales_order_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          params: {
            customer_detail: true,
            part: partId,
            customer: customerId,
            contract: contractId,
            contract_buyer: contractBuyerId,
            contract_seller: contractSellerId,
            work_ticket: workTicketId,
            has_project_code: hasProjectCode
          },
          tableFilters: tableFilters,
          tableActions: tableActions,
          modelType: ModelType.salesorder,
          enableSelection: true,
          enableDownload: true,
          enableReports: true,
          enableLabels: true,
          onRowClick: onSelectSalesOrder,
          rowStyle: (record: any) =>
            record.pk === selectedSalesOrderId
              ? { backgroundColor: 'var(--mantine-color-blue-light)' }
              : undefined
        }}
      />
    </>
  );
}
