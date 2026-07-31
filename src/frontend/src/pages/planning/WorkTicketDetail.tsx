import { Badge, Skeleton, Stack } from '@mantine/core';
import { IconInfoCircle, IconReceipt, IconShoppingCart } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import type { ApiFormFieldSet } from '@lib/types/Forms';
import PrimaryActionButton from '../../components/buttons/PrimaryActionButton';
import { type DetailsField, DetailsTable } from '../../components/details/Details';
import { ItemDetailsGrid } from '../../components/details/ItemDetails';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { useEditApiFormModal } from '../../hooks/UseForm';
import { useInstance } from '../../hooks/UseInstance';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
import { SalesOrderTable } from '../../tables/sales/SalesOrderTable';
import { useUserState } from '../../states/UserState';

const statusFields = {
  status: {
    field_type: 'choice' as const,
    label: 'Trạng thái',
    choices: [
      { value: 'open', display_name: 'Mở' },
      { value: 'processing', display_name: 'Đang xử lý' },
      { value: 'review', display_name: 'Chờ duyệt' },
      { value: 'done', display_name: 'Hoàn thành' }
    ]
  }
};

const ticketFields = (): ApiFormFieldSet => ({
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

export default function WorkTicketDetail() {
  const { id } = useParams();
  const user = useUserState();
  const { instance: ticket, instanceQuery, refreshInstance } = useInstance({
    endpoint: ApiEndpoints.work_ticket_list,
    pk: id,
    refetchOnMount: true
  });
  const updateStatus = useEditApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    pk: id,
    title: 'Chuyển trạng thái công việc',
    fields: statusFields,
    onFormSuccess: refreshInstance
  });
  const editTicket = useEditApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    pk: id,
    title: 'Chỉnh sửa công việc',
    fields: ticketFields(),
    onFormSuccess: refreshInstance
  });
  const canEdit = user.userId() === ticket.assigned_by_detail?.pk;

  const detailsPanel = useMemo(() => {
    if (instanceQuery.isFetching) return <Skeleton />;

    const fields: DetailsField[] = [
      { type: 'text', name: 'code', label: 'Mã công việc', icon: 'reference', copy: true },
      { type: 'text', name: 'title', label: 'Nội dung công việc', icon: 'name', copy: true },
      { type: 'text', name: 'description', label: 'Mô tả', icon: 'description', copy: true },
      { type: 'text', name: 'project_code', label: 'Mã dự án', icon: 'tag', copy: true },
      { type: 'text', name: 'assigned_to_detail.username', label: 'Người thực hiện', icon: 'user' },
      { type: 'text', name: 'assigned_by_detail.username', label: 'Người giao', icon: 'user' },
      {
        type: 'text',
        name: 'status',
        label: 'Trạng thái',
        icon: 'status',
        value_formatter: () => <Badge>{ticket.status}</Badge>
      },
      { type: 'date', name: 'created', label: 'Ngày tạo', icon: 'creation_date', showTime: true },
      { type: 'date', name: 'target_date', label: 'Dự kiến hoàn thành', icon: 'target_date' },
      { type: 'date', name: 'completion_date', label: 'Hoàn thành', icon: 'complete_date', showTime: true },
      { type: 'date', name: 'updated', label: 'Cập nhật', icon: 'calendar', showTime: true }
    ];

    return (
      <ItemDetailsGrid>
        <DetailsTable fields={fields} item={ticket} />
      </ItemDetailsGrid>
    );
  }, [instanceQuery.isFetching, ticket]);

  const panels: PanelType[] = useMemo(
    () => [
      { name: 'detail', label: 'Chi tiết công việc', icon: <IconInfoCircle />, content: detailsPanel },
      {
        name: 'purchase-orders',
        label: 'Đơn mua',
        icon: <IconShoppingCart />,
          content: <PurchaseOrderTable workTicketId={ticket.pk} workTicketProjectCodeId={ticket.project_code} defaultOutstanding={false} />
      },
      {
        name: 'sales-orders',
        label: 'Đơn bán',
        icon: <IconReceipt />,
          content: <SalesOrderTable workTicketId={ticket.pk} workTicketProjectCodeId={ticket.project_code} defaultOutstanding={false} />
      }
    ],
    [detailsPanel, ticket.pk]
  );

  return (
    <>
      {updateStatus.modal}
      {editTicket.modal}
      <InstanceDetail query={instanceQuery}>
        <Stack gap='xs'>
          <PageDetail
            title={ticket.code}
            subtitle={ticket.title}
            badges={[<Badge key='status'>{ticket.status}</Badge>]}
              actions={[
              <PrimaryActionButton
                key='edit-ticket'
                title='Chỉnh sửa công việc'
                icon='edit'
                hidden={!canEdit}
                onClick={editTicket.open}
              />,
              <PrimaryActionButton
                key='change-status'
                title='Chuyển trạng thái'
                icon='status'
                onClick={updateStatus.open}
              />
            ]}
            breadcrumbs={[{ name: 'Kế hoạch', url: '/planning/tickets/index/' }]}
          />
          <PanelGroup
            pageKey='work-ticket'
            panels={panels}
            model={ModelType.workticket}
            instance={ticket}
            id={ticket.pk}
            reloadInstance={refreshInstance}
          />
        </Stack>
      </InstanceDetail>
    </>
  );
}
