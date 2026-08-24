import { Badge, Skeleton, Stack } from '@mantine/core';
import { IconInfoCircle, IconReceipt, IconShoppingCart } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { type DetailsField, DetailsTable } from '../../components/details/Details';
import { ItemDetailsGrid } from '../../components/details/ItemDetails';
import PrimaryActionButton from '../../components/buttons/PrimaryActionButton';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { useInstance } from '../../hooks/UseInstance';
import { useEditApiFormModal } from '../../hooks/UseForm';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
import { SalesOrderTable } from '../../tables/sales/SalesOrderTable';

const statusLabels: Record<string, string> = {
  waiting_approval: 'Chờ duyệt',
  pending: 'Chưa thực hiện',
  done: 'Hoàn thành'
};

export default function ProcurementSubtaskDetail() {
  const { ticketId, subtaskId } = useParams();
  const { instance: ticket } = useInstance({
    endpoint: ApiEndpoints.work_ticket_list,
    pk: ticketId,
    refetchOnMount: true
  });
  const { instance: subtask, instanceQuery, refreshInstance } = useInstance({
    endpoint: ApiEndpoints.procurement_subtask_detail,
    pk: ticketId,
    pathParams: { subtask_pk: subtaskId ?? '' },
    refetchOnMount: true
  });
  const nextStatus = subtask.status === 'waiting_approval' ? 'pending' : (
    subtask.status === 'pending' ? 'done' : undefined
  );
  const updateStatus = useEditApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtask_detail, ticketId, {
      subtask_pk: subtaskId ?? ''
    }),
    title: 'Cập nhật trạng thái mặt hàng',
    fields: {
      status: {
        field_type: 'choice',
        label: 'Trạng thái',
        choices: [
          { value: subtask.status, display_name: statusLabels[subtask.status] ?? subtask.status },
          ...(nextStatus ? [{ value: nextStatus, display_name: statusLabels[nextStatus] }] : [])
        ]
      }
    },
    onFormSuccess: refreshInstance
  });

  const detailsPanel = useMemo(() => {
    if (instanceQuery.isFetching) return <Skeleton />;

    const fields: DetailsField[] = [
      { type: 'text', name: 'title', label: 'Mặt hàng', icon: 'name', copy: true },
      { type: 'text', name: 'item_code', label: 'Mã hàng', icon: 'reference', copy: true },
      { type: 'text', name: 'manufacturer', label: 'Hãng/Xuất xứ', icon: 'details' },
      { type: 'text', name: 'unit', label: 'Đơn vị tính', icon: 'details' },
      { type: 'text', name: 'requested_quantity', label: 'Số lượng cần', icon: 'details' },
      { type: 'text', name: 'note', label: 'Ghi chú', icon: 'description' },
      {
        type: 'text',
        name: 'technical_contact_detail.username',
        label: 'Người đề xuất / Liên hệ kỹ thuật',
        icon: 'user'
      },
      {
        type: 'text',
        name: 'handler_detail.username',
        label: 'Người thực hiện mua hàng',
        icon: 'user'
      },
      {
        type: 'text',
        name: 'status',
        label: 'Trạng thái',
        icon: 'status',
        value_formatter: () => <Badge>{statusLabels[subtask.status] ?? subtask.status}</Badge>
      },
      {
        type: 'text',
        name: 'warehouse_approved_by_detail.username',
        label: 'Người duyệt kho',
        icon: 'user'
      },
      {
        type: 'date',
        name: 'warehouse_approved_at',
        label: 'Thời điểm duyệt kho',
        icon: 'calendar',
        showTime: true
      }
    ];

    return (
      <ItemDetailsGrid>
        <DetailsTable fields={fields} item={subtask} />
      </ItemDetailsGrid>
    );
  }, [instanceQuery.isFetching, subtask]);

  const panels: PanelType[] = useMemo(
    () => [
      { name: 'detail', label: 'Chi tiết mặt hàng', icon: <IconInfoCircle />, content: detailsPanel },
      {
        name: 'purchase-orders',
        label: 'Đơn mua hàng',
        icon: <IconShoppingCart />,
        content: (
          <PurchaseOrderTable
            procurementSubtaskId={subtask.pk}
            workTicketProjectCodeId={ticket.project_code}
            defaultOutstanding={false}
          />
        )
      },
      {
        name: 'sales-orders',
        label: 'Đơn bán hàng',
        icon: <IconReceipt />,
        content: (
          <SalesOrderTable
            procurementSubtaskId={subtask.pk}
            workTicketProjectCodeId={ticket.project_code}
            defaultOutstanding={false}
          />
        )
      }
    ],
    [detailsPanel, subtask.pk, ticket.project_code]
  );

  return (
    <InstanceDetail query={instanceQuery}>
      <Stack gap='xs'>
        {updateStatus.modal}
        <PageDetail
          title={subtask.title || 'Chi tiết mặt hàng'}
          subtitle={subtask.item_code}
          badges={[<Badge key='status'>{statusLabels[subtask.status] ?? subtask.status}</Badge>]}
          breadcrumbs={[
            { name: 'Công việc', url: '/planning/tickets/index/' },
            { name: ticket.code || 'Công việc cha', url: `/planning/tickets/${ticketId}/` }
          ]}
          actions={[
            <PrimaryActionButton
              key='update-subtask-status'
              title={subtask.status === 'waiting_approval' ? 'Duyệt mục' : 'Hoàn thành mục'}
              icon='status'
              hidden={!nextStatus}
              onClick={updateStatus.open}
            />
          ]}
        />
        <PanelGroup
          pageKey='procurement-subtask'
          panels={panels}
          instance={subtask}
          id={subtask.pk}
          reloadInstance={refreshInstance}
        />
      </Stack>
    </InstanceDetail>
  );
}
