import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import { Group, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { getDetailUrl, navigateToLink } from '@lib/functions/Navigation';
import useCalendar from '../../hooks/UseCalendar';
import Calendar from './Calendar';

export default function WorkTicketCalendar() {
  const navigate = useNavigate();
  const state = useCalendar({ endpoint: ApiEndpoints.work_ticket_list, name: 'work-tickets' });

  const events = useMemo(() => {
    const today = dayjs().startOf('day');

    return state.data?.map((ticket: any) => {
      const target = ticket.target_date ? dayjs(ticket.target_date) : undefined;
      const color = ticket.overdue
        ? 'var(--mantine-color-red-6)'
        : target && target.diff(today, 'day') <= 3
          ? 'var(--mantine-color-yellow-6)'
          : 'var(--mantine-color-green-6)';

      return {
        id: ticket.pk,
        title: ticket.code,
        start: ticket.created.slice(0, 10),
        end: ticket.completion_date?.slice(0, 10) || ticket.target_date || ticket.created.slice(0, 10),
        color
      };
    }) ?? [];
  }, [state.data]);

  const eventContent = useCallback(
    (event: EventContentArg) => {
      const ticket = state.data?.find((item: any) => String(item.pk) === event.event.id);
      return (
        <Group gap={4} wrap='nowrap'>
          <Text size='xs' fw={700}>{ticket?.code}</Text>
          <Text size='xs'>{ticket?.title}</Text>
        </Group>
      );
    },
    [state.data]
  );

  return (
    <Calendar
      enableDownload
      enableFilters
      enableSearch
      events={events}
      state={state}
      eventContent={eventContent}
      eventClick={(info: EventClickArg) => navigateToLink(getDetailUrl(ModelType.workticket, info.event.id), navigate, info.jsEvent)}
    />
  );
}
