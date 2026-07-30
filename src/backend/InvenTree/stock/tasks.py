"""Background tasks for the stock app."""

from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.translation import gettext_lazy as _

import structlog
from opentelemetry import trace

from common.settings import get_global_setting
from InvenTree.tasks import ScheduledTask, offload_task, scheduled_task

tracer = trace.get_tracer(__name__)
logger = structlog.get_logger('inventree')


def _create_transfer_notification(transfer, event):
    """Create a single in-app notification for a stock transfer event."""
    from common.models import NotificationMessage

    if not transfer.created_by:
        return

    if event == 'departure':
        name = _('Stock transfer departing soon')
        message = _(
            '%(reference)s will leave %(source)s for %(destination)s on %(date)s'
        ) % {
            'reference': str(transfer),
            'source': transfer.source_location,
            'destination': transfer.destination_location,
            'date': timezone.localtime(transfer.scheduled_departure).strftime(
                '%d/%m/%Y %H:%M'
            ),
        }
    else:
        name = _('Stock transfer arriving soon')
        message = _(
            '%(reference)s is expected at %(destination)s on %(date)s'
        ) % {
            'reference': str(transfer),
            'destination': transfer.destination_location,
            'date': timezone.localtime(transfer.expected_arrival).strftime(
                '%d/%m/%Y %H:%M'
            ),
        }

    NotificationMessage.objects.create(
        target_object=transfer,
        source_object=transfer.created_by,
        user=transfer.created_by,
        category=f'stock.transfer.{event}',
        name=name,
        message=message,
    )


@tracer.start_as_current_span('process_scheduled_stock_transfers')
@scheduled_task(ScheduledTask.MINUTES, 5)
def process_scheduled_stock_transfers():
    """Send transfer warnings and advance due stock transfers."""
    from stock.models import StockTransferOrder

    now = timezone.now()
    active = StockTransferOrder.objects.filter(
        status__in=[
            StockTransferOrder.Status.SCHEDULED,
            StockTransferOrder.Status.IN_TRANSIT,
        ]
    ).select_related('source_location', 'destination_location', 'created_by')

    for transfer in active:
        warning_delta = timedelta(days=transfer.alert_days)

        if (
            not transfer.departure_notified
            and now >= transfer.scheduled_departure - warning_delta
        ):
            _create_transfer_notification(transfer, 'departure')
            transfer.departure_notified = True
            transfer.save(update_fields=['departure_notified', 'updated_at'])

        if (
            not transfer.arrival_notified
            and now >= transfer.expected_arrival - warning_delta
        ):
            _create_transfer_notification(transfer, 'arrival')
            transfer.arrival_notified = True
            transfer.save(update_fields=['arrival_notified', 'updated_at'])

    for transfer in active.filter(
        status=StockTransferOrder.Status.SCHEDULED,
        scheduled_departure__lte=now,
    ):
        try:
            transfer.depart()
        except Exception as exc:
            logger.exception(
                'Failed to depart scheduled stock transfer', transfer=transfer.pk
            )
            StockTransferOrder.objects.filter(pk=transfer.pk).update(
                status=StockTransferOrder.Status.FAILED,
                error_message=str(exc),
            )

    arrivals = StockTransferOrder.objects.filter(
        status=StockTransferOrder.Status.IN_TRANSIT,
        expected_arrival__lte=now,
    )

    for transfer in arrivals:
        try:
            transfer.complete()
        except Exception as exc:
            logger.exception(
                'Failed to complete scheduled stock transfer', transfer=transfer.pk
            )
            StockTransferOrder.objects.filter(pk=transfer.pk).update(
                status=StockTransferOrder.Status.FAILED,
                error_message=str(exc),
            )


@tracer.start_as_current_span('rebuild_stock_items')
def rebuild_stock_items():
    """Rebuild the entire StockItem tree structure.

    This may be necessary if the tree structure has become corrupted or inconsistent.
    """
    from InvenTree.exceptions import log_error
    from InvenTree.sentry import report_exception
    from stock.models import StockItem

    logger.info('Rebuilding StockItem tree structure')

    try:
        StockItem.objects.rebuild()
    except Exception as e:
        # This is a critical error, explicitly report to sentry
        report_exception(e)

        log_error('rebuild_stock_items')
        logger.exception('Failed to rebuild StockItem tree: %s', e)


def rebuild_stock_item_tree(tree_id: int, rebuild_on_fail: bool = True) -> bool:
    """Rebuild the stock tree structure.

    Arguments:
        tree_id (int): The ID of the StockItem tree to rebuild.
        rebuild_on_fail (bool): If True, will attempt to rebuild the entire StockItem tree if the partial rebuild fails.

    Returns:
        bool: True if the partial tree rebuild was successful, False otherwise.

    - If the rebuild fails, schedule a rebuild of the entire StockItem tree.
    """
    from InvenTree.exceptions import log_error
    from InvenTree.sentry import report_exception
    from stock.models import StockItem

    if tree_id:
        try:
            StockItem.objects.partial_rebuild(tree_id)
            logger.info('Rebuilt StockItem tree for tree_id: %s', tree_id)
            return True
        except Exception as e:
            # This is a critical error, explicitly report to sentry
            report_exception(e)

            log_error('rebuild_stock_item_tree')
            logger.warning('Failed to rebuild StockItem tree for tree_id: %s', tree_id)
            # If the partial rebuild fails, rebuild the entire tree
            if rebuild_on_fail:
                offload_task(rebuild_stock_items, group='stock')
            return False
    else:
        # No tree_id provided, so rebuild the entire tree
        StockItem.objects.rebuild()
        return True


@tracer.start_as_current_span('delete_old_stock_tracking')
@scheduled_task(ScheduledTask.DAILY)
def delete_old_stock_tracking():
    """Remove old stock tracking entries before a certain date."""
    from stock.models import StockItemTracking

    if not get_global_setting('STOCK_TRACKING_DELETE_OLD_ENTRIES', False):
        return

    delete_n_days = int(get_global_setting('STOCK_TRACKING_DELETE_DAYS', 365))

    threshold = datetime.now() - timedelta(days=delete_n_days)

    old_entries = StockItemTracking.objects.filter(date__lte=threshold)

    if old_entries.exists():
        logger.info(
            'Deleting old stock tracking entries',
            count=old_entries.count(),
            threshold=threshold,
        )
        old_entries.delete()
