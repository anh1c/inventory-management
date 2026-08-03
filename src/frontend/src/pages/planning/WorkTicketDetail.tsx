import { t } from '@lingui/core/macro';
import { Badge, Skeleton, Stack } from '@mantine/core';
import {
  IconBuildingFactory2,
  IconFileDescription,
  IconHierarchy2,
  IconInfoCircle,
  IconReceipt,
  IconShoppingCart
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import PrimaryActionButton from '../../components/buttons/PrimaryActionButton';
import { type DetailsField, DetailsTable } from '../../components/details/Details';
import { ItemDetailsGrid } from '../../components/details/ItemDetails';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import AttachmentPanel from '../../components/panels/AttachmentPanel';
import NotesPanel from '../../components/panels/NotesPanel';
import { useEditApiFormModal } from '../../hooks/UseForm';
import { useInstance } from '../../hooks/UseInstance';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
import { SalesOrderTable } from '../../tables/sales/SalesOrderTable';
import { ContractTable } from '../../tables/contract/ContractTable';
import { BuildOrderTable } from '../../tables/build/BuildOrderTable';
import { useUserState } from '../../states/UserState';
import WorkTicketTable, {
  nextWorkTicketStatus,
  ticketFields,
  workTicketStatusFields
} from '../../tables/planning/WorkTicketTable';

const statusLabels: Record<string, string> = {
  open: t`Open`,
  processing: t`Processing`,
  review: t`Review`,
  done: t`Done`
};

const priorityLabels: Record<string, string> = {
  low: t`Low`,
  normal: t`Normal`,
  high: t`High`,
  urgent: t`Urgent`
};

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
    title: t`Update Work Status`,
    fields: workTicketStatusFields(ticket, user.userId(), user.isStaff()),
    onFormSuccess: refreshInstance
  });
  const editTicket = useEditApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    pk: id,
    title: t`Edit Work Ticket`,
    fields: ticketFields(),
    onFormSuccess: refreshInstance
  });
  const updateProgress = useEditApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    pk: id,
    title: t`Update Work Progress`,
    fields: {
      actual_hours: { field_type: 'number', label: t`Actual Hours` },
      notes: { field_type: 'string', label: t`Discussion and Notes` }
    },
    onFormSuccess: refreshInstance
  });
  const canEdit =
    user.isStaff() ||
    user.userId() === ticket.assigned_by_detail?.pk ||
    user.userId() === ticket.plan_detail?.manager_detail?.pk ||
    user.userId() === ticket.plan_detail?.created_by_detail?.pk;
  const canAdvance = Boolean(
    nextWorkTicketStatus(ticket, user.userId(), user.isStaff())
  );
  const canUpdateProgress = user.userId() === ticket.assigned_to_detail?.pk;

  const detailsPanel = useMemo(() => {
    if (instanceQuery.isFetching) return <Skeleton />;

    const fields: DetailsField[] = [
      { type: 'text', name: 'code', label: t`Work Code`, icon: 'reference', copy: true },
      { type: 'text', name: 'title', label: t`Work Content`, icon: 'name', copy: true },
      { type: 'text', name: 'description', label: t`Description`, icon: 'description', copy: true },
      {
        type: 'link',
        name: 'plan',
        label: t`Work Plan`,
        icon: 'calendar',
        model: ModelType.workplan,
        model_formatter: () => ticket.plan_detail?.code ?? '-',
        hidden: !ticket.plan
      },
      {
        type: 'text',
        name: 'project_code_detail.code',
        label: t`Project Code`,
        icon: 'sitemap',
        copy: true
      },
      {
        type: 'link',
        name: 'parent',
        label: t`Parent Work Ticket`,
        icon: 'sitemap',
        model: ModelType.workticket,
        model_formatter: () => ticket.parent_detail?.code ?? '-',
        hidden: !ticket.parent
      },
      {
        type: 'text',
        name: 'dependencies',
        label: t`Dependencies`,
        icon: 'link',
        value_formatter: () =>
          ticket.dependency_details?.map((item: any) => item.code).join(', ') || '-'
      },
      { type: 'text', name: 'assigned_to_detail.username', label: t`Assigned To`, icon: 'user' },
      { type: 'text', name: 'assigned_by_detail.username', label: t`Assigned By`, icon: 'user' },
      {
        type: 'text',
        name: 'priority',
        label: t`Priority`,
        icon: 'priority',
        value_formatter: () => priorityLabels[ticket.priority] ?? ticket.priority
      },
      {
        type: 'text',
        name: 'status',
        label: t`Status`,
        icon: 'status',
        value_formatter: () => <Badge>{statusLabels[ticket.status] ?? ticket.status}</Badge>
      },
      { type: 'date', name: 'created', label: t`Creation Date`, icon: 'creation_date', showTime: true },
      { type: 'date', name: 'start_date', label: t`Start Date`, icon: 'calendar' },
      { type: 'date', name: 'target_date', label: t`Target Completion Date`, icon: 'target_date' },
      { type: 'date', name: 'completion_date', label: t`Completion Date`, icon: 'complete_date', showTime: true },
      { type: 'text', name: 'estimated_hours', label: t`Estimated Hours`, icon: 'time' },
      { type: 'text', name: 'actual_hours', label: t`Actual Hours`, icon: 'time' },
      { type: 'date', name: 'updated', label: t`Updated`, icon: 'calendar', showTime: true }
    ];

    return (
      <ItemDetailsGrid>
        <DetailsTable fields={fields} item={ticket} />
      </ItemDetailsGrid>
    );
  }, [instanceQuery.isFetching, ticket]);

  const panels: PanelType[] = useMemo(
    () => [
      { name: 'detail', label: t`Work Details`, icon: <IconInfoCircle />, content: detailsPanel },
      {
        name: 'subtasks',
        label: t`Subtasks`,
        icon: <IconHierarchy2 />,
        content: (
          <WorkTicketTable
            planId={ticket.plan}
            projectCodeId={ticket.project_code}
            parentId={ticket.pk}
            canCreate={canEdit}
          />
        )
      },
      {
        name: 'purchase-orders',
        label: t`Purchase Orders`,
        icon: <IconShoppingCart />,
          content: <PurchaseOrderTable workTicketId={ticket.pk} workTicketProjectCodeId={ticket.project_code} defaultOutstanding={false} />
      },
      {
        name: 'sales-orders',
        label: t`Sales Orders`,
        icon: <IconReceipt />,
          content: <SalesOrderTable workTicketId={ticket.pk} workTicketProjectCodeId={ticket.project_code} defaultOutstanding={false} />
      },
      {
        name: 'contracts',
        label: t`Contracts`,
        icon: <IconFileDescription />,
        content: (
          <ContractTable
            workTicketId={ticket.pk}
            workTicketProjectCodeId={ticket.project_code}
          />
        )
      },
      {
        name: 'build-orders',
        label: t`Build Orders`,
        icon: <IconBuildingFactory2 />,
        content: (
          <BuildOrderTable
            workTicketId={ticket.pk}
            workTicketProjectCodeId={ticket.project_code}
          />
        )
      },
      AttachmentPanel({
        model_type: ModelType.workticket,
        model_id: ticket.pk,
        label: t`Work Attachments`
      }),
      NotesPanel({
        model_type: ModelType.workticket,
        model_id: ticket.pk,
        label: t`Discussion and Notes`,
        editable: canEdit,
        has_note: !!ticket.notes
      })
    ],
    [canEdit, detailsPanel, ticket]
  );

  return (
    <>
      {updateStatus.modal}
      {editTicket.modal}
      {updateProgress.modal}
      <InstanceDetail query={instanceQuery}>
        <Stack gap='xs'>
          <PageDetail
            title={ticket.code}
            subtitle={ticket.title}
            badges={[<Badge key='status'>{statusLabels[ticket.status] ?? ticket.status}</Badge>]}
              actions={[
              <PrimaryActionButton
                key='edit-ticket'
                title={t`Edit Work Ticket`}
                icon='edit'
                hidden={!canEdit}
                onClick={editTicket.open}
              />,
              <PrimaryActionButton
                key='change-status'
                title={t`Update Work Status`}
                icon='status'
                hidden={!canAdvance}
                onClick={updateStatus.open}
              />,
              <PrimaryActionButton
                key='update-progress'
                title={t`Update Work Progress`}
                icon='time'
                hidden={!canUpdateProgress}
                onClick={updateProgress.open}
              />
            ]}
            breadcrumbs={[{ name: t`Work Plans`, url: '/planning/plans/index/' }]}
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
