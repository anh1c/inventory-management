import { t } from '@lingui/core/macro';
import {
  ActionIcon,
  Alert,
  Container,
  Flex,
  FocusTrap,
  Group,
  HoverCard,
  Modal,
  Table,
  TextInput
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAddressBook,
  IconCalendar,
  IconCoins,
  IconCurrencyDollar,
  IconHash,
  IconInfoCircle,
  IconLink,
  IconList,
  IconNotes,
  IconPackages,
  IconPlus,
  IconSitemap,
  IconUser,
  IconUsers
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { ActionButton } from '@lib/components/ActionButton';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { IconCalendarExclamation } from '@tabler/icons-react';
import dayjs from 'dayjs';
import RemoveRowButton from '../components/buttons/RemoveRowButton';
import { StandaloneField } from '../components/forms/StandaloneField';

import { ProgressBar } from '@lib/components/ProgressBar';
import { apiUrl } from '@lib/functions/Api';
import { toNumber } from '@lib/functions/Conversion';
import type {
  ApiFormAdjustFilterType,
  ApiFormFieldSet,
  ApiFormFieldType
} from '@lib/types/Forms';
import {
  TableFieldExtraRow,
  type TableFieldRowProps
} from '../components/forms/fields/TableField';
import { Thumbnail } from '../components/images/Thumbnail';
import { StylishText } from '../components/items/StylishText';
import { getStatusCodeOptions } from '../components/render/StatusRenderer';
import { InvenTreeIcon } from '../functions/icons';
import { useCreateApiFormModal } from '../hooks/UseForm';
import {
  useBatchCodeGenerator,
  useSerialNumberGenerator
} from '../hooks/UseGenerator';
import { useGlobalSettingsState } from '../states/SettingsStates';
import { useBuildOrderFields } from './BuildForms';
import { useSalesOrderFields } from './SalesOrderForms';
/*
 * Construct a set of fields for creating / editing a PurchaseOrderLineItem instance
 */
export function usePurchaseOrderLineItemFields({
  supplierId,
  orderId,
  order,
  currency,
  create
}: {
  supplierId?: number;
  orderId?: number;
  order?: any;
  currency?: string;
  create?: boolean;
}) {
  const globalSettings = useGlobalSettingsState();

  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [purchasePriceCurrency, setPurchasePriceCurrency] = useState<string>(
    currency ?? ''
  );

  const [autoPricing, setAutoPricing] = useState(false);

  const [quantity, setQuantity] = useState<string>('1');
  const [selectedSalesOrderLine, setSelectedSalesOrderLine] = useState<any>(undefined);
  const [selectedBuildLine, setSelectedBuildLine] = useState<any>(undefined);

  // Internal part information
  const [part, setPart] = useState<any>({});
  const [priceBreaks, setPriceBreaks] = useState<any[]>([]);
  const [suggestedPurchasePrice, setSuggestedPurchasePrice] = useState<
    string | undefined
  >(undefined);

  // Update suggested purchase price when part, quantity, or price breaks change
  useEffect(() => {
    // Only attempt to set purchase price for new line items
    if (!create) return;

    const qty = toNumber(quantity, null);

    if (qty == null || qty <= 0) {
      setSuggestedPurchasePrice(undefined);
      return;
    }

    if (!part || !priceBreaks || priceBreaks.length === 0) {
      setSuggestedPurchasePrice(undefined);
      return;
    }

    const applicablePriceBreaks = priceBreaks
      .filter((pb: any) => qty >= pb.quantity)
      .sort((a: any, b: any) => b.quantity - a.quantity);

    if (applicablePriceBreaks.length) {
      setSuggestedPurchasePrice(applicablePriceBreaks[0].price);
    } else {
      setSuggestedPurchasePrice(undefined);
    }
  }, [create, part, quantity, priceBreaks]);

  const fields = useMemo(() => {
    const fields: ApiFormFieldSet = {
      order: {
        filters: {
          supplier_detail: true
        },
        disabled: true
      },
      sales_order_line: {
        field_type: 'related field',
        api_url: apiUrl(ApiEndpoints.sales_order_line_list),
        label: 'Dòng hàng đơn bán',
        description: 'Chọn dòng hàng từ đơn bán hàng liên kết để mua',
        hidden: order?.output_type !== 'commercial',
        filters: {
          order: order?.sales_order,
          completed: false,
          part_detail: true
        },
        onValueChange: (_value: any, record?: any) => {
          setSelectedSalesOrderLine(record);

          const remaining =
            (toNumber(record?.quantity, 0) ?? 0) -
            (toNumber(record?.shipped, 0) ?? 0);

          if (remaining > 0) {
            setQuantity(String(remaining));
          }
        }
      },
      build_line: {
        field_type: 'related field',
        api_url: apiUrl(ApiEndpoints.build_line_list),
        label: 'Dòng hàng đơn sản xuất',
        description: 'Chọn dòng hàng từ đơn sản xuất liên kết để mua',
        hidden:
          order?.output_type !== 'workshop' ||
          !order?.build_order ||
          globalSettings.isSet('BUILDORDER_DISABLED', true),
        filters: {
          build: order?.build_order,
          allocated: false,
          part_detail: true
        },
        onValueChange: (_value: any, record?: any) => {
          setSelectedBuildLine(record);

          const remaining =
            (toNumber(record?.quantity, 0) ?? 0) -
            (toNumber(record?.consumed, 0) ?? 0) -
            (toNumber(record?.allocated, 0) ?? 0);

          if (remaining > 0) {
            setQuantity(String(remaining));
          }
        }
      },
      part: {
        filters: {
          part_detail: true,
          supplier_detail: true,
          active: true,
          part_active: true,
          price_breaks: true
        },
        onValueChange: (value, record) => {
          setPriceBreaks(record?.price_breaks ?? []);
          setPart(record?.part_detail ?? {});
        },
        adjustFilters: (adjust: ApiFormAdjustFilterType) => {
          return {
            ...adjust.filters,
            supplier: supplierId,
            part:
              selectedSalesOrderLine?.part ??
              selectedBuildLine?.part ??
              adjust.filters.part
          };
        }
      },
      line: {},
      reference: {},
      quantity: {
        value: quantity,
        onValueChange: (value) => {
          setQuantity(value);
        }
      },
      purchase_price: {
        icon: <IconCurrencyDollar />,
        value: purchasePrice,
        disabled: autoPricing,
        placeholder: suggestedPurchasePrice,
        placeholderAutofill: true,
        onValueChange: setPurchasePrice
      },
      purchase_price_currency: {
        icon: <IconCoins />,
        value: purchasePriceCurrency,
        onValueChange: setPurchasePriceCurrency
      },
      auto_pricing: {
        default: create !== false,
        value: autoPricing,
        onValueChange: setAutoPricing
      },
      project_code: {
        description: t`Select project code for this line item`
      },
      target_date: {
        icon: <IconCalendar />
      },
      destination: {
        icon: <IconSitemap />
      },
      build_order: {
        disabled: !part?.assembly,
        hidden: order?.output_type === 'workshop' || order?.output_type === 'commercial',
        filters: {
          external: true,
          outstanding: true,
          part: part?.pk
        }
      },
      notes: {
        icon: <IconNotes />
      },
      link: {
        icon: <IconLink />
      }
    };

    if (
      globalSettings.isSet('BUILDORDER_DISABLED', true) ||
      !globalSettings.isSet('BUILDORDER_EXTERNAL_BUILDS', false)
    ) {
      delete fields.build_order;
    }

    if (create) {
      fields['merge_items'] = {};
    }

    return fields;
  }, [
    create,
    orderId,
    part,
    order,
    globalSettings,
    supplierId,
    selectedSalesOrderLine,
    selectedBuildLine,
    autoPricing,
    purchasePrice,
    suggestedPurchasePrice
  ]);

  return fields;
}

/**
 * Construct a set of fields for creating / editing a PurchaseOrder instance
 */
export function usePurchaseOrderFields({
  supplierId,
  duplicateOrderId,
  create,
  initialOutputType,
  projectCodeId
}: {
  supplierId?: number;
  duplicateOrderId?: number;
  create?: boolean;
  initialOutputType?: string;
  projectCodeId?: number;
}): ApiFormFieldSet {
  const globalSettings = useGlobalSettingsState();
  const [selectedContract, setSelectedContract] = useState<any>(undefined);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | undefined>(
    supplierId
  );
  const [startDate, setStartDate] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [selectedOutputType, setSelectedOutputType] = useState<string | undefined>(
    initialOutputType
  );
  const [selectedProjectCodeId, setSelectedProjectCodeId] = useState<number | undefined>(projectCodeId);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<number | undefined>();
  const [selectedDestination, setSelectedDestination] = useState<number | undefined>();
  const [selectedBuildOrder, setSelectedBuildOrder] = useState<number | undefined>();
  const linkedSalesContractId = selectedContract?.sales_contract ?? undefined;
  const buildOrdersEnabled = !globalSettings.isSet('BUILDORDER_DISABLED', true);
  const salesOrderFields = useSalesOrderFields({
    create: true,
    linkedPurchaseContractId: selectedContract?.pk,
    linkedSalesContractId
  });
  const buildOrderFields = useBuildOrderFields({
    create: true,
    modalId: 'create-build-order-from-purchase-order'
  });
  const newSalesOrder = useCreateApiFormModal({
    url: ApiEndpoints.sales_order_list,
    title: t`Add Sales Order`,
    fields: salesOrderFields,
    initialData: {
      project_code: selectedProjectCodeId
    },
    onFormSuccess: (data: any) => {
      setSelectedSalesOrderId(data?.pk);
    }
  });
  const newBuildOrder = useCreateApiFormModal({
    url: ApiEndpoints.build_order_list,
    title: t`Add Build Order`,
    fields: buildOrderFields,
    initialData: {
      project_code: selectedProjectCodeId
    },
    onFormSuccess: (data: any) => {
      setSelectedBuildOrder(data?.pk);
    }
  });

  useEffect(() => {
    setSelectedOutputType(initialOutputType);
  }, [initialOutputType]);

  useEffect(() => {
    setSelectedProjectCodeId(projectCodeId);
  }, [projectCodeId]);

  const onOutputTypeChange = (value: any) => {
    const outputType = value || undefined;

    setSelectedOutputType(outputType);

    if (outputType === 'commercial') {
      setSelectedDestination(undefined);
      setSelectedBuildOrder(undefined);
    }

    if (outputType !== 'commercial') {
      setSelectedSalesOrderId(undefined);
    }

    if (outputType !== 'workshop') {
      setSelectedBuildOrder(undefined);
    }
  };

  const onDestinationChange = (value: any) => {
    setSelectedDestination(value ?? undefined);
  };

  const onBuildOrderChange = (value: any) => {
    setSelectedBuildOrder(value ?? undefined);
  };

  const contractDateError = useMemo(() => {
    if (!selectedContract) return undefined;

    const issueDate = selectedContract.issue_date;
    const effectiveDate = selectedContract.effective_date;

    if (startDate && issueDate && startDate < issueDate) {
      return 'Ngày bắt đầu phải nằm trong thời hạn hợp đồng đã chọn';
    }

    if (startDate && effectiveDate && startDate > effectiveDate) {
      return 'Ngày bắt đầu phải nằm trong thời hạn hợp đồng đã chọn';
    }

    if (targetDate && issueDate && targetDate < issueDate) {
      return 'Ngày mục tiêu phải nằm trong thời hạn hợp đồng đã chọn';
    }

    if (targetDate && effectiveDate && targetDate > effectiveDate) {
      return 'Ngày mục tiêu phải nằm trong thời hạn hợp đồng đã chọn';
    }

    return undefined;
  }, [selectedContract, startDate, targetDate]);

  const setContract = (record?: any) => {
    setSelectedContract(record);
    setSelectedProjectCodeId(record?.project_code ?? projectCodeId);
    setSelectedSalesOrderId(undefined);

    if (!supplierId) {
      setSelectedSupplierId(undefined);
    }

    if (record?.seller && !supplierId) {
      setSelectedSupplierId(record.seller);
    }
  };

  const destinationLabel = useMemo(() => {
    if (selectedOutputType === 'workshop') {
      return 'Vị trí xưởng';
    }

    if (selectedOutputType === 'construction_site') {
      return 'Vị trí công trường';
    }

    return 'Kho đích';
  }, [selectedOutputType]);

  const destinationFilters = useMemo(() => {
    const filters: Record<string, any> = {
      structural: false
    };

    if (selectedOutputType === 'workshop') {
      filters.location_type_name = 'Xưởng';
    } else if (selectedOutputType === 'construction_site') {
      filters.location_type_name = 'Công trường';
    }

    return filters;
  }, [selectedOutputType]);

  return useMemo(() => {
    const contractField: ApiFormFieldType | undefined = create
      ? {
          field_type: 'related field',
          api_url: apiUrl(ApiEndpoints.contract_list),
          icon: <IconLink />,
          label: 'Hợp đồng mua',
          description: 'Chọn hợp đồng mua liên kết với đơn mua hàng này',
          filters: {
            contract_type: 'purchase',
            ...(projectCodeId ? { project_code: projectCodeId } : {})
          },
          onValueChange: (_value: any, record?: any) => setContract(record)
        }
      : undefined;

    const fields: ApiFormFieldSet = {
      reference: {
        label: 'Mã đơn mua hàng',
        icon: <IconHash />
      },
      ...(contractField ? { contract: contractField } : {}),
      project_code: {
        label: 'Mã dự án',
        icon: <IconList />,
        required: true,
        value: projectCodeId ?? selectedProjectCodeId,
        disabled: !!projectCodeId || !!selectedContract?.project_code,
        onValueChange: (value: any) => setSelectedProjectCodeId(value)
      },
      description: {
        label: 'Mô tả'
      },
      supplier: {
        label: 'Nhà cung cấp',
        value: selectedSupplierId,
        disabled: !!duplicateOrderId || !!supplierId,
        filters: {
          is_supplier: true,
          active: true
        }
      },
      supplier_reference: {
        label: 'Mã tham chiếu nhà cung cấp'
      },
      output_type: {
        field_type: 'choice',
        icon: <IconSitemap />,
        label: 'Đầu ra sử dụng',
        description: 'Chọn đầu ra cho đơn mua: Mặc định, Xưởng, Công trường hoặc Thương mại',
        choices: [
          { value: '', display_name: 'Mặc định' },
          { value: 'workshop', display_name: 'Xưởng' },
          { value: 'construction_site', display_name: 'Công trường' },
          { value: 'commercial', display_name: 'Thương mại' }
        ],
        onValueChange: onOutputTypeChange
      },
      destination: {
        label: destinationLabel,
        hidden: selectedOutputType === 'commercial',
        disabled: !!selectedBuildOrder,
        filters: destinationFilters,
        onValueChange: onDestinationChange
      },
      build_order: {
        field_type: 'related field',
        model: ModelType.build,
        api_url: apiUrl(ApiEndpoints.build_order_list),
        icon: <IconPackages />,
        label: 'Đơn sản xuất liên kết',
        description: 'Liên kết đơn mua hàng này với đơn sản xuất đang chưa hoàn thiện',
        value: selectedBuildOrder,
        hidden: selectedOutputType !== 'workshop' || !buildOrdersEnabled,
        disabled: !!selectedDestination || !selectedProjectCodeId,
        filters: {
          outstanding: true,
          external: false,
          project_code: selectedProjectCodeId
        },
        onValueChange: onBuildOrderChange,
        leftSection: (
          <ActionButton
            color='green'
            disabled={
              !!selectedDestination ||
              !!selectedBuildOrder ||
              !selectedProjectCodeId ||
              !buildOrdersEnabled
            }
            icon={<IconPlus />}
            size='lg'
            tooltip={t`Add Build Order`}
            onClick={(event: any) => {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              if (
                selectedDestination ||
                selectedBuildOrder ||
                !selectedProjectCodeId ||
                !buildOrdersEnabled
              ) {
                return;
              }
              newBuildOrder.open();
            }}
          />
        ),
        postFieldContent: newBuildOrder.modal
      },
      sales_order: {
        field_type: 'related field',
        model: ModelType.salesorder,
        api_url: apiUrl(ApiEndpoints.sales_order_list),
        icon: <IconLink />,
        label: 'Đơn bán hàng liên kết',
        description: t`Liên kết đơn mua hàng này với đơn bán hàng nguồn. Mã dự án mặc định được xử lý bởi hệ thống backend.`,
        value: selectedSalesOrderId,
        hidden: selectedOutputType !== 'commercial',
        filters: {
          commercial_linkable: true,
          ...(linkedSalesContractId ? { contract: linkedSalesContractId } : {})
        },
        onValueChange: (value: any) => setSelectedSalesOrderId(value),
        leftSection: (
          <ActionButton
            color='green'
            disabled={!!selectedSalesOrderId}
            icon={<IconPlus />}
            size='lg'
            tooltip={t`Add Sales Order`}
            onClick={(event: any) => {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              if (selectedSalesOrderId) {
                return;
              }
              newSalesOrder.open();
            }}
          />
        ),
        postFieldContent: newSalesOrder.modal
      },
      order_currency: {
        label: 'Tiền tệ',
        icon: <IconCoins />
      },
      start_date: {
        label: 'Ngày bắt đầu',
        icon: <IconCalendar />,
        error: contractDateError,
        onValueChange: (value: any) => setStartDate(value)
      },
      target_date: {
        label: 'Ngày mục tiêu',
        icon: <IconCalendar />,
        error: contractDateError,
        onValueChange: (value: any) => setTargetDate(value)
      },
      link: {
        label: 'Liên kết'
      },
      contact: {
        label: 'Liên hệ',
        icon: <IconUser />,
        adjustFilters: (value: ApiFormAdjustFilterType) => {
          return {
            ...value.filters,
            company: value.data.supplier
          };
        }
      },
      address: {
        label: 'Địa chỉ',
        icon: <IconAddressBook />,
        adjustFilters: (value: ApiFormAdjustFilterType) => {
          return {
            ...value.filters,
            company: value.data.supplier
          };
        }
      },
      responsible: {
        label: 'Người phụ trách',
        filters: {
          is_active: true
        },
        icon: <IconUsers />
      }
    };

    // Order duplication fields
    if (!!duplicateOrderId) {
      fields.duplicate = {
        children: {
          order_id: {
            hidden: true,
            value: duplicateOrderId
          },
          copy_lines: {},
          copy_extra_lines: {},
          copy_parameters: {}
        }
      };
    }

    if (!globalSettings.isSet('PROJECT_CODES_ENABLED', true)) {
      delete fields.project_code;
    }

    return fields;
  }, [
    create,
    destinationFilters,
    destinationLabel,
    duplicateOrderId,
    projectCodeId,
    supplierId,
    selectedSupplierId,
    selectedContract,
    selectedProjectCodeId,
    linkedSalesContractId,
    selectedOutputType,
    selectedSalesOrderId,
    selectedDestination,
    selectedBuildOrder,
    buildOrdersEnabled,
    globalSettings,
    contractDateError,
    newSalesOrder,
    newBuildOrder
  ]);
}

/**
 * Render a table row for a single TableField entry
 */
function LineItemFormRow({
  props,
  record,
  statuses,
  directAllocationOrder = false
}: Readonly<{
  props: TableFieldRowProps;
  record: any;
  statuses: any;
  directAllocationOrder?: boolean;
}>) {
  // Barcode Modal state
  const [opened, { open, close }] = useDisclosure(false, {
    onClose: () => props.changeFn(props.idx, 'barcode', undefined)
  });

  const [locationOpen, locationHandlers] = useDisclosure(false, {
    onClose: () => props.changeFn(props.idx, 'location', undefined)
  });

  // Is this a trackable part?
  const trackable: boolean = useMemo(
    () => record.part_detail?.trackable ?? false,
    [record]
  );

  const settings = useGlobalSettingsState();

  useEffect(() => {
    if (!!record.destination) {
      props.changeFn(props.idx, 'location', record.destination);
      locationHandlers.open();
    }
  }, [record.destination]);

  // Batch code generator
  const batchCodeGenerator = useBatchCodeGenerator({
    isEnabled: () => batchOpen,
    onGenerate: (value: any) => {
      if (value) {
        props.changeFn(props.idx, 'batch_code', value);
      }
    }
  });

  // Serial number generator
  const serialNumberGenerator = useSerialNumberGenerator({
    isEnabled: () => trackable
  });

  const [packagingOpen, packagingHandlers] = useDisclosure(false, {
    onClose: () => {
      props.changeFn(props.idx, 'packaging', undefined);
    }
  });

  const [noteOpen, noteHandlers] = useDisclosure(false, {
    onClose: () => {
      props.changeFn(props.idx, 'note', undefined);
    }
  });

  const [batchOpen, batchHandlers] = useDisclosure(false, {
    onClose: () => {
      props.changeFn(props.idx, 'batch_code', undefined);
    },
    onOpen: () => {
      // Generate a new batch code
      batchCodeGenerator.update({
        part: record?.supplier_part_detail?.part,
        order: record?.order
      });
    }
  });

  const [serialOpen, serialHandlers] = useDisclosure(false, {
    onClose: () => {
      props.changeFn(props.idx, 'serial_numbers', undefined);
    },
    onOpen: () => {
      // Generate new serial numbers
      if (trackable) {
        serialNumberGenerator.update({
          part: record?.supplier_part_detail?.part,
          quantity: props.item.quantity
        });
      } else {
        props.changeFn(props.idx, 'serial_numbers', undefined);
      }
    }
  });

  const [expiryDateOpen, expiryDateHandlers] = useDisclosure(false, {
    onOpen: () => {
      // check the default part expiry. Assume expiry is relative to today
      const defaultExpiry = record.part_detail?.default_expiry;
      if (defaultExpiry !== undefined && defaultExpiry > 0) {
        props.changeFn(
          props.idx,
          'expiry_date',
          dayjs().add(defaultExpiry, 'day').format('YYYY-MM-DD')
        );
      }
    },
    onClose: () => {
      props.changeFn(props.idx, 'expiry_date', undefined);
    }
  });

  // Status value
  const [statusOpen, statusHandlers] = useDisclosure(false, {
    onClose: () => props.changeFn(props.idx, 'status', undefined)
  });

  // Barcode value
  const [barcodeInput, setBarcodeInput] = useState<any>('');
  const [barcode, setBarcode] = useState<string | undefined>(undefined);

  // Change form value when state is altered
  useEffect(() => {
    props.changeFn(props.idx, 'barcode', barcode);
  }, [barcode]);

  // Update location field description on state change
  useEffect(() => {
    if (!opened) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setBarcode(barcodeInput.length ? barcodeInput : null);
      close();
      setBarcodeInput('');
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [barcodeInput]);

  // Info string with details about certain selected locations
  const locationDescription = useMemo(() => {
    const text = t`Choose Location`;

    if (location === null) {
      return text;
    }

    // Selected location is order line destination
    if (location === record.destination) {
      return t`Item Destination selected`;
    }

    // Selected location is base part's category default location
    if (
      !record.destination &&
      !record.destination_detail &&
      record.part_detail &&
      location === record.part_detail?.category_default_location
    ) {
      return t`Part category default location selected`;
    }

    // Selected location is identical to already received stock for this line
    if (
      !record.destination &&
      record.destination_detail &&
      location === record.destination_detail.pk &&
      record.received > 0
    ) {
      return t`Received stock location selected`;
    }

    // Selected location is base part's default location
    if (
      record.part_detail?.default_location &&
      location === record.part_detail.default_location
    ) {
      return t`Default location selected`;
    }

    return text;
  }, [location]);

  // Handle virtual parts
  const virtual = useMemo(
    () => record.part_detail?.virtual ?? false,
    [record.part_detail]
  );

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title={<StylishText>{t`Scan Barcode`}</StylishText>}
      >
        <FocusTrap>
          <TextInput
            label='Barcode data'
            data-autofocus
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
          />
        </FocusTrap>
      </Modal>
      <Table.Tr>
        <Table.Td>
          <Group gap='xs' justify='space-between'>
            <Group gap='xs' justify='left'>
              <Thumbnail
                size={40}
                src={record.part_detail.thumbnail}
                align='center'
              />
              <div>{record.part_detail.name}</div>
            </Group>
            {virtual && (
              <HoverCard>
                <HoverCard.Target>
                  <ActionIcon color='blue' variant='transparent'>
                    <IconInfoCircle />
                  </ActionIcon>
                </HoverCard.Target>
                <HoverCard.Dropdown>
                  <Alert color='blue' title={t`Virtual Part`}>
                    {t`This part is virtual, no physical stock will be received.`}
                  </Alert>
                </HoverCard.Dropdown>
              </HoverCard>
            )}
          </Group>
        </Table.Td>
        <Table.Td>{record.supplier_part_detail.SKU}</Table.Td>
        <Table.Td>
          <ProgressBar
            value={record.received}
            maximum={record.quantity}
            progressLabel
          />
        </Table.Td>
        <Table.Td style={{ whiteSpace: 'nowrap' }}>
          <StandaloneField
            fieldName='quantity'
            fieldDefinition={{
              field_type: 'number',
              value: props.item.quantity,
              onValueChange: (value) => {
                props.changeFn(props.idx, 'quantity', value);
                serialNumberGenerator.update({ quantity: value });
              }
            }}
            error={props.rowErrors?.quantity?.message}
          />
        </Table.Td>
        <Table.Td style={{ width: '1%', whiteSpace: 'nowrap' }}>
          <Flex gap='1px'>
            {!directAllocationOrder && (
              <ActionButton
                size='sm'
                onClick={() => locationHandlers.toggle()}
                icon={<InvenTreeIcon icon='location' />}
                tooltip={t`Set Location`}
                tooltipAlignment='top'
                variant={locationOpen ? 'outline' : 'transparent'}
                disabled={virtual}
              />
            )}
            <ActionButton
              size='sm'
              onClick={() => batchHandlers.toggle()}
              icon={<InvenTreeIcon icon='batch_code' />}
              tooltip={t`Assign Batch Code`}
              tooltipAlignment='top'
              variant={batchOpen ? 'outline' : 'transparent'}
              disabled={virtual}
            />
            {trackable && (
              <ActionButton
                size='sm'
                onClick={() => serialHandlers.toggle()}
                icon={<InvenTreeIcon icon='serial' />}
                tooltip={t`Assign Serial Numbers`}
                tooltipAlignment='top'
                variant={serialOpen ? 'outline' : 'transparent'}
                disabled={virtual}
              />
            )}

            {settings.isSet('STOCK_ENABLE_EXPIRY') && (
              <ActionButton
                size='sm'
                onClick={() => expiryDateHandlers.toggle()}
                icon={<IconCalendarExclamation />}
                tooltip={t`Set Expiry Date`}
                tooltipAlignment='top'
                variant={expiryDateOpen ? 'outline' : 'transparent'}
                disabled={virtual}
              />
            )}
            <ActionButton
              size='sm'
              icon={<InvenTreeIcon icon='packaging' />}
              tooltip={t`Adjust Packaging`}
              tooltipAlignment='top'
              onClick={() => packagingHandlers.toggle()}
              variant={packagingOpen ? 'outline' : 'transparent'}
              disabled={virtual}
            />
            <ActionButton
              onClick={() => statusHandlers.toggle()}
              icon={<InvenTreeIcon icon='status' />}
              tooltip={t`Change Status`}
              tooltipAlignment='top'
              variant={statusOpen ? 'outline' : 'transparent'}
              disabled={virtual}
            />
            <ActionButton
              icon={<InvenTreeIcon icon='note' />}
              tooltip={t`Add Note`}
              tooltipAlignment='top'
              variant={noteOpen ? 'outline' : 'transparent'}
              onClick={() => noteHandlers.toggle()}
              disabled={virtual}
            />
            {barcode ? (
              <ActionButton
                icon={<InvenTreeIcon icon='unlink' />}
                tooltip={t`Unlink Barcode`}
                tooltipAlignment='top'
                variant='filled'
                color='red'
                onClick={() => setBarcode(undefined)}
                disabled={virtual}
              />
            ) : (
              <ActionButton
                icon={<InvenTreeIcon icon='barcode' />}
                tooltip={t`Scan Barcode`}
                tooltipAlignment='top'
                variant='transparent'
                onClick={() => open()}
                disabled={virtual}
              />
            )}
          </Flex>
        </Table.Td>
        <Table.Td>
          <RemoveRowButton onClick={() => props.removeFn(props.idx)} />
        </Table.Td>
      </Table.Tr>
      {locationOpen && !directAllocationOrder && (
        <Table.Tr>
          <Table.Td colSpan={10}>
            <Group grow preventGrowOverflow={false} justify='flex-apart' p='xs'>
              <Container flex={0} p='xs'>
                <InvenTreeIcon icon='downright' />
              </Container>
              <StandaloneField
                fieldDefinition={{
                  field_type: 'related field',
                  model: ModelType.stocklocation,
                  api_url: apiUrl(ApiEndpoints.stock_location_list),
                  filters: {
                    structural: false
                  },
                  onValueChange: (value) => {
                    props.changeFn(props.idx, 'location', value);
                  },
                  description: locationDescription,
                  value: props.item.location,
                  label: t`Location`,
                  icon: <InvenTreeIcon icon='location' />
                }}
                defaultValue={
                  record.destination ??
                  (record.destination_detail
                    ? record.destination_detail.pk
                    : null)
                }
              />
              <Flex style={{ marginBottom: '7px' }}>
                {(record.part_detail?.default_location ||
                  record.part_detail?.category_default_location) && (
                  <ActionButton
                    icon={<InvenTreeIcon icon='default_location' />}
                    tooltip={t`Store at default location`}
                    onClick={() =>
                      props.changeFn(
                        props.idx,
                        'location',
                        record.part_detail?.default_location ??
                          record.part_detail?.category_default_location
                      )
                    }
                    tooltipAlignment='top'
                  />
                )}
                {record.destination && (
                  <ActionButton
                    icon={<InvenTreeIcon icon='destination' />}
                    tooltip={t`Store at line item destination `}
                    onClick={() =>
                      props.changeFn(props.idx, 'location', record.destination)
                    }
                    tooltipAlignment='top'
                  />
                )}
                {!record.destination &&
                  record.destination_detail &&
                  record.received > 0 && (
                    <ActionButton
                      icon={<InvenTreeIcon icon='repeat_destination' />}
                      tooltip={t`Store with already received stock`}
                      onClick={() =>
                        props.changeFn(
                          props.idx,
                          'location',
                          record.destination_detail.pk
                        )
                      }
                      tooltipAlignment='top'
                    />
                  )}
              </Flex>
            </Group>
          </Table.Td>
        </Table.Tr>
      )}
      <TableFieldExtraRow
        visible={batchOpen}
        onValueChange={(value) => {
          props.changeFn(props.idx, 'batch_code', value);
        }}
        fieldName='batch_code'
        fieldDefinition={{
          field_type: 'string',
          label: t`Batch Code`,
          description: t`Enter batch code for received items`,
          value: props.item.batch_code
        }}
        error={props.rowErrors?.batch_code?.message}
      />
      <TableFieldExtraRow
        visible={serialOpen}
        onValueChange={(value) =>
          props.changeFn(props.idx, 'serial_numbers', value)
        }
        fieldName='serial_numbers'
        fieldDefinition={{
          field_type: 'string',
          label: t`Serial Numbers`,
          description: t`Enter serial numbers for received items`,
          value: props.item.serial_numbers,
          placeholderAutofill: true,
          placeholder:
            serialNumberGenerator.result && `${serialNumberGenerator.result}`
        }}
        error={props.rowErrors?.serial_numbers?.message}
      />
      {settings.isSet('STOCK_ENABLE_EXPIRY') && (
        <TableFieldExtraRow
          visible={expiryDateOpen}
          onValueChange={(value) =>
            props.changeFn(props.idx, 'expiry_date', value)
          }
          fieldName='expiry_date'
          fieldDefinition={{
            field_type: 'date',
            label: t`Expiry Date`,
            description: t`Enter an expiry date for received items`,
            value: props.item.expiry_date
          }}
          error={props.rowErrors?.expiry_date?.message}
        />
      )}
      <TableFieldExtraRow
        visible={packagingOpen}
        onValueChange={(value) => props.changeFn(props.idx, 'packaging', value)}
        fieldName='packaging'
        fieldDefinition={{
          field_type: 'string',
          label: t`Packaging`
        }}
        defaultValue={record?.supplier_part_detail?.packaging}
        error={props.rowErrors?.packaging?.message}
      />
      <TableFieldExtraRow
        visible={statusOpen}
        defaultValue={10}
        fieldName='status'
        onValueChange={(value) => props.changeFn(props.idx, 'status', value)}
        fieldDefinition={{
          field_type: 'choice',
          api_url: apiUrl(ApiEndpoints.stock_status),
          choices: statuses,
          label: t`Status`
        }}
        error={props.rowErrors?.status?.message}
      />
      <TableFieldExtraRow
        visible={noteOpen}
        fieldName='note'
        onValueChange={(value) => props.changeFn(props.idx, 'note', value)}
        fieldDefinition={{
          field_type: 'string',
          label: t`Note`
        }}
        error={props.rowErrors?.note?.message}
      />
    </>
  );
}

type LineFormHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
};

type LineItemsForm = {
  items: any[];
  orderPk: number;
  destinationPk?: number;
  directAllocationOrder?: boolean;
  formProps?: LineFormHandlers;
};

export function useReceiveLineItems(props: LineItemsForm) {
  const stockStatusCodes = useMemo(
    () => getStatusCodeOptions(ModelType.stockitem),
    []
  );

  const records = Object.fromEntries(
    props.items.map((item) => [item.pk, item])
  );

  const filteredItems = props.items.filter(
    (elem) => elem.quantity !== elem.received
  );

  const fields: ApiFormFieldSet = useMemo(() => {
    return {
      id: {
        value: props.orderPk,
        hidden: true
      },
      items: {
        field_type: 'table',
        value: filteredItems.map((elem, idx) => {
          return {
            line_item: elem.pk,
            location: props.directAllocationOrder
              ? null
              : (elem.destination ?? elem.destination_detail?.pk ?? null),
            quantity: elem.quantity - elem.received,
            expiry_date: null,
            batch_code: '',
            serial_numbers: '',
            status: 10,
            barcode: null
          };
        }),
        modelRenderer: (row: TableFieldRowProps) => {
          const record = records[row.item.line_item];

          if (!record) {
            return null;
          }

          return (
            <LineItemFormRow
              props={row}
              record={record}
              statuses={stockStatusCodes}
              directAllocationOrder={props.directAllocationOrder}
              key={record.pk}
            />
          );
        },
        headers: [
          { title: t`Part`, style: { minWidth: '200px' } },
          { title: t`SKU`, style: { minWidth: '200px' } },
          { title: t`Received`, style: { minWidth: '200px' } },
          { title: t`Quantity`, style: { width: '200px' } },
          { title: t`Actions` },
          { title: '', style: { width: '50px' } }
        ]
      },
      location: {
        hidden: props.directAllocationOrder,
        filters: {
          structural: false
        }
      }
    };
  }, [filteredItems, props, stockStatusCodes]);

  return useCreateApiFormModal({
    ...props.formProps,
    url: apiUrl(ApiEndpoints.purchase_order_receive, props.orderPk),
    title: t`Receive Line Items`,
    fields: fields,
    initialData: {
      location: props.destinationPk
    },
    size: '80%',
    successMessage: t`Items received`
  });
}
