import { Anchor, Badge } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddItemButton } from '@lib/components/AddItemButton';
import { RowEditAction, type RowAction } from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import { getDetailUrl, navigateToLink } from '@lib/functions/Navigation';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import type { ApiFormFieldSet } from '@lib/types/Forms';
import { InvenTreeTable } from '../InvenTreeTable';
import { useCreateApiFormModal, useEditApiFormModal } from '../../hooks/UseForm';
import { usePurchaseOrderFields } from '../../forms/PurchaseOrderForms';
import { useSalesOrderFields } from '../../forms/SalesOrderForms';
import { useContractFields } from '../../forms/ContractForms';

const ticketFields = (): ApiFormFieldSet => ({
  code: { field_type: 'string', label: 'Mã công việc', read_only: true },
  title: { field_type: 'string', label: 'Nội dung công việc', required: true },
  description: { field_type: 'string', label: 'Mô tả' },
  target_date: { field_type: 'date', label: 'Dự kiến hoàn thành' },
  project_code: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.project_code_list),
    label: 'Mã dự án',
    required: true
  },
  assigned_to: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.user_list),
    label: 'Người thực hiện',
    required: true
  }
});

const statusFields = (): ApiFormFieldSet => ({
  status: {
    field_type: 'choice',
    label: 'Trạng thái',
    choices: [
      { value: 'open', display_name: 'Mở' },
      { value: 'processing', display_name: 'Đang xử lý' },
      { value: 'review', display_name: 'Chờ duyệt' },
      { value: 'done', display_name: 'Hoàn thành' }
    ]
  }
});

export default function WorkTicketTable() {
  const navigate = useNavigate();
  const table = useTable('work-tickets');
  const [selectedTicket, setSelectedTicket] = useState<number>();
  const purchaseOrderFields = usePurchaseOrderFields({ create: true });
  const salesOrderFields = useSalesOrderFields({ create: true });
  const contractFields = useContractFields({});
  const tableFilters: TableFilter[] = [
    {
      name: 'status',
      label: 'Trạng thái',
      type: 'choice',
      choices: [
        { value: 'open', label: 'Mở' },
        { value: 'processing', label: 'Đang xử lý' },
        { value: 'review', label: 'Chờ duyệt' },
        { value: 'done', label: 'Hoàn thành' }
      ]
    },
    { name: 'overdue', label: 'Quá hạn', type: 'boolean' },
    {
      name: 'project_code',
      label: 'Mã dự án',
      type: 'api',
      apiUrl: apiUrl(ApiEndpoints.project_code_list)
    },
    {
      name: 'assigned_to',
      label: 'Người thực hiện',
      type: 'api',
      apiUrl: apiUrl(ApiEndpoints.user_list)
    }
  ];
  const newTicket = useCreateApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    title: 'Giao việc',
    fields: ticketFields(),
    table
  });
  const updateStatus = useEditApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    pk: selectedTicket,
    title: 'Cập nhật trạng thái ticket',
    fields: statusFields(),
    table
  });
  const newPurchaseOrder = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: 'Tạo đơn mua từ ticket',
    fields: {
      ...purchaseOrderFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket }
    },
    initialData: { work_ticket: selectedTicket },
    table
  });
  const newSalesOrder = useCreateApiFormModal({
    url: ApiEndpoints.sales_order_list,
    title: 'Tạo đơn bán từ ticket',
    fields: {
      ...salesOrderFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket }
    },
    initialData: { work_ticket: selectedTicket },
    table
  });
  const newContract = useCreateApiFormModal({
    url: ApiEndpoints.contract_list,
    title: 'Tạo hợp đồng từ ticket',
    fields: {
      ...contractFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket }
    },
    initialData: { work_ticket: selectedTicket },
    table
  });

  const columns = useMemo(
    () => [
      {
        accessor: 'code',
        title: 'Mã công việc',
        sortable: true,
        render: (record: any) => (
          <Anchor
            href={getDetailUrl(ModelType.workticket, record.pk, true)}
            onClick={(event) =>
              navigateToLink(getDetailUrl(ModelType.workticket, record.pk), navigate, event)
            }
          >
            {record.code}
          </Anchor>
        )
      },
      { accessor: 'title', title: 'Công việc', sortable: true },
      { accessor: 'project_code', title: 'Mã dự án', sortable: true },
      { accessor: 'target_date', title: 'Dự kiến hoàn thành', sortable: true },
      { accessor: 'completion_date', title: 'Hoàn thành', sortable: true },
      {
        accessor: 'assigned_to__username',
        title: 'Người thực hiện',
        render: (record: any) => record.assigned_to_detail?.username
      },
      {
        accessor: 'assigned_by__username',
        title: 'Người giao',
        render: (record: any) => record.assigned_by_detail?.username
      },
      {
        accessor: 'status',
        title: 'Trạng thái',
        render: (record: any) => (
          <Badge color={record.overdue ? 'red' : undefined}>
            {record.overdue ? 'Quá hạn' : record.status}
          </Badge>
        )
      }
    ],
    [navigate]
  );

  const rowActions = useCallback(
    (record: any): RowAction[] => [
      RowEditAction({
        onClick: () => {
          setSelectedTicket(record.pk);
          updateStatus.open();
        }
      }),
      {
        title: 'Tạo đơn mua',
        onClick: () => {
          setSelectedTicket(record.pk);
          newPurchaseOrder.open();
        }
      },
      {
        title: 'Tạo đơn bán',
        onClick: () => {
          setSelectedTicket(record.pk);
          newSalesOrder.open();
        }
      },
      {
        title: 'Tạo hợp đồng',
        onClick: () => {
          setSelectedTicket(record.pk);
          newContract.open();
        }
      }
    ],
    [newContract, newPurchaseOrder, newSalesOrder, updateStatus]
  );

  return (
    <>
      {newTicket.modal}
      {updateStatus.modal}
      {newPurchaseOrder.modal}
      {newSalesOrder.modal}
      {newContract.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.work_ticket_list)}
        tableState={table}
        columns={columns}
        props={{
          rowActions,
          tableFilters,
          enableDownload: true,
          tableActions: [
            <AddItemButton key='add-ticket' tooltip='Giao việc' onClick={() => newTicket.open()} />
          ]
        }}
      />
    </>
  );
}
